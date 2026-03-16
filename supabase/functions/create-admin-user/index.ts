import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserRequest {
  email: string;
  role: "customer" | "sales_rep" | "distributor" | "admin";
  fullName?: string;
  phone?: string;
  // Customer-specific
  organizationId?: string;
  orgRole?: string;
  isHouseAccount?: boolean;
  salesRepId?: string;
  // Sales rep-specific
  isIndependent?: boolean;
  distributorId?: string;
  // Commission split fields (for company-affiliated sales reps)
  commissionSplitType?: "percentage_of_distributor" | "fixed_with_override";
  salesRepRate?: number;
  distributorOverrideRate?: number;
  // W-9 fields (for independent sales rep or distributor)
  taxId?: string;
  taxIdType?: "ein" | "ssn";
  legalName?: string;
  businessName?: string;
  taxClassification?: string;
  w9Consent?: boolean;
  // Org creation
  createOrganization?: boolean;
  newOrgName?: string;
  newOrgCode?: string;
  orgType?: "customer" | "distributor";
  // Delegate creation (distributor adding a delegate user)
  delegateForDistributorId?: string;
  delegateNotes?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Missing authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !caller) {
      return jsonResponse({ success: false, error: "Invalid or expired token" }, 401);
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !["admin", "distributor"].includes(callerProfile.role)) {
      return jsonResponse({ success: false, error: "Only admins and distributors can create users" }, 403);
    }

    const callerIsAdmin = callerProfile.role === "admin";
    const callerIsDistributor = callerProfile.role === "distributor";

    const body: CreateUserRequest = await req.json();

    if (!body.email || !body.role) {
      return jsonResponse({ success: false, error: "Email and role are required" }, 400);
    }

    // Validate role
    if (!["customer", "sales_rep", "distributor", "admin"].includes(body.role)) {
      return jsonResponse({ success: false, error: "Invalid role" }, 400);
    }

    // Distributors can only create sales_rep or distributor (delegate) users
    if (callerIsDistributor) {
      if (!["sales_rep", "distributor"].includes(body.role)) {
        return jsonResponse({ success: false, error: "Distributors can only create sales reps and delegates" }, 403);
      }
      // Verify the distributor owns the distributorId or delegateForDistributorId they're targeting
      const targetDistId = body.distributorId || body.delegateForDistributorId;
      if (targetDistId) {
        const { data: ownedDist } = await adminClient
          .from("distributors")
          .select("id")
          .eq("id", targetDistId)
          .eq("profile_id", caller.id)
          .single();
        if (!ownedDist) {
          // Check if they're a delegate for this distributor
          const { data: delegateAccess } = await adminClient
            .from("distributor_delegates")
            .select("id")
            .eq("distributor_id", targetDistId)
            .eq("user_id", caller.id)
            .eq("is_active", true)
            .single();
          if (!delegateAccess) {
            return jsonResponse({ success: false, error: "You don't have access to this distributor" }, 403);
          }
        }
      }
    }

    // ═══════════════════════════════════════
    // 1. Create Auth user (random password — user sets their own via invite email)
    // ═══════════════════════════════════════
    const tempPassword = crypto.randomUUID() + crypto.randomUUID();
    const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: false,
      user_metadata: { full_name: body.fullName || "" },
    });

    if (createError) {
      return jsonResponse({ success: false, error: createError.message }, 400);
    }

    const userId = authData.user.id;

    // ═══════════════════════════════════════
    // 2. Create/update profile
    // ═══════════════════════════════════════
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: userId,
        email: body.email,
        role: body.role,
        approval_status: "approved",
        approved: true,
        full_name: body.fullName || null,
        phone: body.phone || null,
      }, { onConflict: "id" });

    if (profileError) {
      // Clean up auth user on profile failure
      await adminClient.auth.admin.deleteUser(userId);
      return jsonResponse({ success: false, error: `Profile creation failed: ${profileError.message}` }, 500);
    }

    // ═══════════════════════════════════════
    // 3. Send invite email
    // ═══════════════════════════════════════
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(body.email);
    if (inviteError) {
      console.error("Invite email failed (non-fatal):", inviteError.message);
      // Non-fatal — user is created, admin can resend later
    }

    // ═══════════════════════════════════════
    // 4. Role-specific setup
    // ═══════════════════════════════════════
    let organizationId = body.organizationId;

    // Handle org creation if requested
    if (body.createOrganization && body.newOrgName && body.newOrgCode) {
      const orgType = body.orgType || (body.role === "distributor" ? "distributor" : "customer");
      const { data: newOrg, error: orgError } = await adminClient
        .from("organizations")
        .insert({
          name: body.newOrgName,
          code: body.newOrgCode,
          org_type: orgType,
          is_house_account: body.role === "customer" && body.isHouseAccount === true,
          created_by: caller.id,
          is_active: true,
        })
        .select("id")
        .single();

      if (orgError) {
        return jsonResponse({
          success: false,
          error: `Organization creation failed: ${orgError.message}`,
          userId,
        }, 500);
      }
      organizationId = newOrg.id;
    }

    // --- CUSTOMER setup ---
    if (body.role === "customer") {
      if (organizationId) {
        // Set house account flag if needed
        if (body.isHouseAccount) {
          await adminClient
            .from("organizations")
            .update({ is_house_account: true })
            .eq("id", organizationId);
        }

        // Assign user to organization
        await adminClient
          .from("user_organization_roles")
          .upsert({
            user_id: userId,
            organization_id: organizationId,
            role: body.orgRole || "member",
            is_primary: true,
          }, { onConflict: "user_id,organization_id,location_id" });

        // Assign sales rep if not a house account
        if (!body.isHouseAccount && body.salesRepId) {
          // Find the sales rep's distributor
          const { data: repDistributor } = await adminClient
            .from("distributor_sales_reps")
            .select("distributor_id")
            .eq("sales_rep_id", body.salesRepId)
            .eq("is_active", true)
            .limit(1)
            .single();

          const distributorId = repDistributor?.distributor_id || null;

          // Create organization_sales_reps link
          await adminClient
            .from("organization_sales_reps")
            .upsert({
              organization_id: organizationId,
              sales_rep_id: body.salesRepId,
              distributor_id: distributorId,
              is_active: true,
            }, { onConflict: "organization_id,sales_rep_id" });

          // Auto-link customer org to distributor
          if (distributorId) {
            await adminClient
              .from("distributor_customers")
              .upsert({
                distributor_id: distributorId,
                organization_id: organizationId,
              }, { onConflict: "distributor_id,organization_id" });

            // Also link via distributor_rep_customers for commission fallback
            await adminClient
              .from("distributor_rep_customers")
              .upsert({
                distributor_id: distributorId,
                sales_rep_id: body.salesRepId,
                organization_id: organizationId,
                is_active: true,
              }, { onConflict: "distributor_id,sales_rep_id,organization_id" });
          }
        }
      }
    }

    // --- SALES REP setup ---
    if (body.role === "sales_rep") {
      if (body.isIndependent !== false) {
        // Independent: auto-create distributor entity linked to same profile
        const repName = body.fullName || body.email.split("@")[0];
        const code = `IND-${body.email.split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`;

        const { data: newDist, error: distError } = await adminClient
          .from("distributors")
          .insert({
            profile_id: userId,
            name: repName,
            code,
            distributor_class: "independent",
            contact_name: body.fullName || null,
            phone: body.phone || null,
            is_active: true,
            // W-9 fields
            tax_id: body.taxId || null,
            tax_id_type: body.taxIdType || null,
            legal_name: body.legalName || null,
            business_name: body.businessName || null,
            tax_classification: body.taxClassification || null,
            w9_consent: body.w9Consent === true,
            w9_consent_date: body.w9Consent ? new Date().toISOString() : null,
            w9_status: body.w9Consent ? "received" : "pending",
          })
          .select("id")
          .single();

        if (distError) {
          return jsonResponse({
            success: false,
            error: `Distributor creation failed: ${distError.message}`,
            userId,
          }, 500);
        }

        // Self-link: sales rep belongs to their own distributor entity
        await adminClient
          .from("distributor_sales_reps")
          .upsert({
            distributor_id: newDist.id,
            sales_rep_id: userId,
            commission_split_type: "percentage_of_distributor",
            sales_rep_rate: 100,
            distributor_override_rate: 0,
            is_active: true,
          }, { onConflict: "distributor_id,sales_rep_id" });

      } else if (body.distributorId) {
        // Company-affiliated: link to existing distributor with commission split
        const repLink: Record<string, unknown> = {
          distributor_id: body.distributorId,
          sales_rep_id: userId,
          is_active: true,
        };
        if (body.commissionSplitType) {
          repLink.commission_split_type = body.commissionSplitType;
        }
        if (body.salesRepRate !== undefined) {
          repLink.sales_rep_rate = body.salesRepRate;
        }
        if (body.commissionSplitType === "fixed_with_override" && body.distributorOverrideRate !== undefined) {
          repLink.distributor_override_rate = body.distributorOverrideRate;
        }
        await adminClient
          .from("distributor_sales_reps")
          .upsert(repLink, { onConflict: "distributor_id,sales_rep_id" });
      }
    }

    // --- DISTRIBUTOR setup ---
    if (body.role === "distributor") {
      if (body.delegateForDistributorId) {
        // Delegate: add user as delegate for an existing distributor (no new distributor entity)
        await adminClient
          .from("distributor_delegates")
          .upsert({
            distributor_id: body.delegateForDistributorId,
            user_id: userId,
            is_active: true,
            notes: body.delegateNotes || null,
          }, { onConflict: "distributor_id,user_id" });
      } else {
        // New distributor entity
        const distName = body.fullName || body.newOrgName || body.email.split("@")[0];
        const code = `DIST-${(body.newOrgCode || body.email.split("@")[0]).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`;

        const { error: distError } = await adminClient
          .from("distributors")
          .insert({
            profile_id: userId,
            name: distName,
            code,
            distributor_class: "company",
            contact_name: body.fullName || null,
            phone: body.phone || null,
            is_active: true,
            // W-9 fields
            tax_id: body.taxId || null,
            tax_id_type: body.taxIdType || null,
            legal_name: body.legalName || null,
            business_name: body.businessName || null,
            tax_classification: body.taxClassification || null,
            w9_consent: body.w9Consent === true,
            w9_consent_date: body.w9Consent ? new Date().toISOString() : null,
            w9_status: body.w9Consent ? "received" : "pending",
          });

        if (distError) {
          return jsonResponse({
            success: false,
            error: `Distributor creation failed: ${distError.message}`,
            userId,
          }, 500);
        }

        // Assign to distributor org if provided
        if (organizationId) {
          await adminClient
            .from("user_organization_roles")
            .upsert({
              user_id: userId,
              organization_id: organizationId,
              role: "admin",
              is_primary: true,
            }, { onConflict: "user_id,organization_id,location_id" });
        }
      }
    }

    // --- ADMIN setup ---
    // No additional setup needed for admin role

    return jsonResponse({
      success: true,
      userId,
      inviteEmailSent: !inviteError,
    });

  } catch (err) {
    console.error("create-admin-user error:", err);
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : "Internal server error",
    }, 500);
  }
});

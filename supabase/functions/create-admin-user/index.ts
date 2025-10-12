import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateUserRequest {
  email: string;
  password: string;
  role: string;
  is_approved: boolean;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  organizationRole?: string;
  createOrganization?: boolean;
  newOrgName?: string;
  newOrgCode?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: CreateUserRequest = await req.json();
    const {
      email,
      password,
      role,
      is_approved,
      firstName,
      lastName,
      organizationId,
      organizationRole,
      createOrganization,
      newOrgName,
      newOrgCode
    } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if ((role === 'customer' || role === 'sales_rep') && !organizationId && !createOrganization) {
      return new Response(JSON.stringify({ error: 'Customer and Sales Rep users require an organization assignment' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (createOrganization && (!newOrgName || !newOrgCode)) {
      return new Response(JSON.stringify({ error: 'Organization name and code are required when creating a new organization' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        is_approved,
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!authData.user) {
      return new Response(JSON.stringify({ error: 'User creation failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role,
        is_approved,
        first_name: firstName,
        last_name: lastName,
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
    }

    let finalOrganizationId = organizationId;

    if (createOrganization && newOrgName && newOrgCode) {
      const { data: existingOrg } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('code', newOrgCode)
        .maybeSingle();

      if (existingOrg) {
        return new Response(JSON.stringify({ error: `Organization with code ${newOrgCode} already exists` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: newOrg, error: orgCreateError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: newOrgName,
          code: newOrgCode,
          is_active: true,
        })
        .select()
        .single();

      if (orgCreateError || !newOrg) {
        console.error('Organization creation error:', orgCreateError);
        return new Response(JSON.stringify({ error: 'Failed to create organization' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      finalOrganizationId = newOrg.id;
    }

    if (finalOrganizationId && organizationRole) {
      const { error: orgError } = await supabaseAdmin
        .from('user_organization_roles')
        .insert({
          user_id: authData.user.id,
          organization_id: finalOrganizationId,
          role: organizationRole,
          is_primary: true,
        });

      if (orgError) {
        console.error('Organization assignment error:', orgError);
        return new Response(JSON.stringify({ error: 'Failed to assign user to organization' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user: { 
        id: authData.user.id, 
        email: authData.user.email 
      } 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-admin-user:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TemplateSection {
  heading: string;
  placeholder: string;
  type?: "paragraph" | "list";
}

interface ProductPayload {
  name: string;
  category?: string;
  brand?: string;
  price?: number;
  sku?: string;
  condition?: string;
  weight?: number;
  weightUnit?: string;
  benefits?: string[];
  existingDescription?: string;
  templateSections?: TemplateSection[];
  systemPrompt?: string;
  guidelines?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: ProductPayload = await req.json();

    if (!payload.name) {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(payload);
    const systemPrompt = payload.systemPrompt ||
      "You are a professional product copywriter for a health and wellness e-commerce platform that serves healthcare practitioners and clinics. Write detailed, accurate product descriptions.";

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    let description: string;

    if (openaiKey) {
      description = await generateWithOpenAI(openaiKey, prompt, systemPrompt);
    } else {
      description = await generateWithBuiltIn(prompt);
    }

    return new Response(
      JSON.stringify({ description }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildPrompt(product: ProductPayload): string {
  const parts = [
    `Generate a professional, detailed product description for an e-commerce store.`,
    `\nProduct Name: ${product.name}`,
  ];

  if (product.category) parts.push(`Category: ${product.category}`);
  if (product.brand) parts.push(`Brand: ${product.brand}`);
  if (product.price) parts.push(`Price: $${product.price.toFixed(2)}`);
  if (product.sku) parts.push(`SKU: ${product.sku}`);
  if (product.condition) parts.push(`Condition: ${product.condition}`);
  if (product.weight && product.weightUnit) {
    parts.push(`Weight: ${product.weight} ${product.weightUnit}`);
  }
  if (product.benefits && product.benefits.length > 0) {
    parts.push(`Known Benefits: ${product.benefits.join(", ")}`);
  }
  if (product.existingDescription) {
    parts.push(`Existing Description (expand on this): ${product.existingDescription}`);
  }

  const htmlStructure = buildHtmlStructure(product.templateSections);
  parts.push(`\nPlease provide the response in the following HTML format:\n${htmlStructure}`);

  const guidelines = product.guidelines || getDefaultGuidelines();
  parts.push(`\nImportant guidelines:\n${guidelines}`);

  return parts.join("\n");
}

function buildHtmlStructure(sections?: TemplateSection[]): string {
  if (!sections || sections.length === 0) {
    return `<div>
  <h3>Overview</h3>
  <p>[2-3 sentences summarizing what this product is and who it's for]</p>

  <h3>Key Benefits</h3>
  <ul>
    <li>[Benefit 1]</li>
    <li>[Benefit 2]</li>
    <li>[Benefit 3]</li>
    <li>[Benefit 4]</li>
  </ul>

  <h3>How It Works</h3>
  <p>[2-3 sentences explaining the mechanism or usage]</p>

  <h3>Suggested Use</h3>
  <p>[Directions for use or recommended dosage/application]</p>

  <h3>Quality Assurance</h3>
  <p>[1-2 sentences about quality, testing, or manufacturing standards]</p>
</div>`;
  }

  const sectionHtml = sections.map(s => {
    if (s.type === "list") {
      const items = s.placeholder
        .split("\n")
        .filter(Boolean)
        .map(line => `    <li>[${line}]</li>`)
        .join("\n");
      return `  <h3>${s.heading}</h3>\n  <ul>\n${items}\n  </ul>`;
    }
    return `  <h3>${s.heading}</h3>\n  <p>[${s.placeholder}]</p>`;
  }).join("\n\n");

  return `<div>\n${sectionHtml}\n</div>`;
}

function getDefaultGuidelines(): string {
  return `- Write in a professional, informative tone suitable for healthcare practitioners
- Do NOT make specific medical claims or diagnoses
- Use phrases like "may support", "designed to help", "formulated for"
- Focus on ingredients, mechanisms, and practical benefits
- Keep it factual and evidence-informed
- Do not include any markdown, only return clean HTML`;
}

async function generateWithOpenAI(apiKey: string, prompt: string, systemPrompt: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function generateWithBuiltIn(prompt: string): Promise<string> {
  try {
    // @ts-ignore - Supabase.ai is available in the edge runtime
    const model = new Supabase.ai.Session("mistral");
    const output = await model.run(prompt);

    if (typeof output === "string") return output;
    if (output?.content) return output.content;
    if (output?.text) return output.text;

    return JSON.stringify(output);
  } catch {
    return generateFallbackDescription(prompt);
  }
}

function generateFallbackDescription(prompt: string): string {
  const nameMatch = prompt.match(/Product Name: (.+)/);
  const name = nameMatch ? nameMatch[1] : "This product";
  const categoryMatch = prompt.match(/Category: (.+)/);
  const category = categoryMatch ? categoryMatch[1] : "health and wellness";
  const brandMatch = prompt.match(/Brand: (.+)/);
  const brand = brandMatch ? brandMatch[1] : "";

  return `<div>
  <h3>Overview</h3>
  <p>${name} is a professional-grade ${category.toLowerCase()} product${brand ? ` by ${brand}` : ""} designed for healthcare practitioners and their patients. This formulation is crafted to meet the highest standards of quality and efficacy.</p>

  <h3>Key Benefits</h3>
  <ul>
    <li>Professional-grade formulation</li>
    <li>Designed for healthcare practitioners</li>
    <li>Quality-tested ingredients</li>
    <li>Manufactured under strict quality controls</li>
  </ul>

  <h3>How It Works</h3>
  <p>This product utilizes carefully selected ingredients to support optimal health outcomes. Please consult the full product specifications for detailed ingredient information and mechanisms of action.</p>

  <h3>Suggested Use</h3>
  <p>Use as directed by your healthcare practitioner. Refer to the product label for specific dosage and administration guidelines.</p>

  <h3>Quality Assurance</h3>
  <p>Manufactured in a GMP-certified facility with rigorous third-party testing to ensure purity, potency, and safety.</p>
</div>`;
}

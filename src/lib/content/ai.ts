import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { getSettings } from "../settings";
import { recordSpend, withinBudget } from "./spend";

/** The AI writer needs ANTHROPIC_API_KEY in the hosting environment (never in the admin or the code). */
export const writerReady = () => !!process.env.ANTHROPIC_API_KEY;

/** $ per million tokens (input, output) = millionths of a dollar per token. */
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-fable-5-1": [10, 50],
};
export const WRITER_MODELS = Object.keys(PRICES);
/** A full four-language page costs about this much; checked against the budget before writing. */
const ESTIMATE_MICROS = 400_000;

const PageSchema = z.object({
  title: z.string().describe("Search title with the main keyword, at most 60 characters"),
  description: z.string().describe("Meta description, at most 155 characters, with the keyword and a reason to click"),
  intro: z.string().describe("Two or three short paragraphs separated by a blank line"),
  steps: z.array(z.string()).describe("How it works, 3 to 6 short steps"),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })).describe("2 to 4 sections; body paragraphs separated by a blank line"),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).describe("4 to 6 real customer questions with short answers"),
});
export type WrittenPage = z.infer<typeof PageSchema>;

const LANG_NAMES: Record<string, string> = { en: "English", ht: "Haitian Creole (Kreyòl ayisyen, natural everyday spelling)", fr: "French", es: "Spanish", pt: "Brazilian Portuguese", ar: "Modern Standard Arabic (brand names stay in Latin script)" };

const RULES = `You write pages for GSMLite, an online store for phone unlocking, IMEI checks and repair-tool credits.
Use ONLY the facts given in the request. Never invent prices, delivery times, success rates, supported models, carriers, guarantees, legal claims or customer numbers.
If a fact is missing, leave it out rather than guess. Never promise that an unlock always works; say what happens when it can't be done only if the facts say so.
Never show a full IMEI; sample results are already masked. Do not mention competitors.
Plain text only: no Markdown, no HTML, no emojis. Paragraphs are separated by one blank line.
Each language version is written for native readers of that language, not translated word for word, and uses the same facts.`;

/**
 * Write one page in every requested language from the facts given. Records what it cost.
 * Throws when the writer is not connected, the monthly budget is spent, or the model declines.
 */
export async function writePage(input: { kind: string; keyword: string; facts: string; languages: string[] }): Promise<{ pages: Record<string, WrittenPage>; costMicros: number; model: string }> {
  if (!writerReady()) throw new Error("The AI writer is not connected: add ANTHROPIC_API_KEY in the hosting environment");
  if (!(await withinBudget(ESTIMATE_MICROS))) throw new Error("This month's writing budget is spent (Admin → Content machine)");
  const { contentMachine } = await getSettings();
  const model = WRITER_MODELS.includes(contentMachine.model) ? contentMachine.model : "claude-opus-5-5";
  const langs = input.languages.filter((l) => l in LANG_NAMES);
  const schema = z.object(Object.fromEntries(langs.map((l) => [l, PageSchema])) as Record<string, typeof PageSchema>);
  const client = new Anthropic();

  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    system: `${RULES}\n\nBrand voice: ${contentMachine.tone}`,
    messages: [
      {
        role: "user",
        content: `Write a ${input.kind} page.\nMain keyword: "${input.keyword}"\nLanguages: ${langs.map((l) => `${l} = ${LANG_NAMES[l]}`).join("; ")}\n\nFacts (the only source of truth):\n${input.facts}`,
      },
    ],
  });

  const [inPrice, outPrice] = PRICES[model];
  const costMicros = response.usage.input_tokens * inPrice + response.usage.output_tokens * outPrice;
  await recordSpend("ai", costMicros, `${input.kind}: ${input.keyword}`);
  if (response.stop_reason === "refusal") throw new Error("The writer declined this page");
  if (response.stop_reason === "max_tokens") throw new Error("The page came out too long: try fewer languages");
  const pages = response.parsed_output as Record<string, WrittenPage> | null;
  if (!pages) throw new Error("The writer's answer could not be read");
  return { pages, costMicros, model: response.model };
}

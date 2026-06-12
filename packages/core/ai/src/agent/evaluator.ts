import { LLMManager } from '../llm/manager';
import { validateSchema, fixSchema } from '../a2ui/schema-validator';
import type { ISchema } from '@formai/shared';

export class CritiqueEvaluator {
  constructor(private llm: LLMManager) {}

  /**
   * Evaluate a generated schema and heal it if there are validation errors.
   * Runs an iterative feedback loop with the LLM to correct schema errors.
   */
  async evaluateAndHealSchema(
    schema: any,
    prompt: string,
    model: string,
    provider: string,
    maxRetries = 3,
  ): Promise<any> {
    let currentSchema = schema;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const validation = validateSchema(currentSchema as ISchema);
      if (validation.valid) {
        return currentSchema;
      }

      // If invalid, construct feedback and chat with LLM to correct
      const feedback = `The generated JSON schema has the following validation errors:\n${validation.errors.join(
        '\n',
      )}\n\nOriginal requirement: "${prompt}"\n\nPlease correct the JSON schema and return ONLY the valid JSON object.`;

      try {
        const response = await this.llm.chat(
          [
            {
              role: 'system',
              content:
                'You are an expert low-code JSON Schema validator. Return ONLY the valid JSON schema object. Do not include markdown code block syntax (like ```json) in your final response.',
            },
            { role: 'user', content: feedback },
          ],
          { model, provider, temperature: 0.1 },
        );

        let cleanedContent = response.content.trim();
        if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/^```(json)?\n/, '').replace(/\n```$/, '');
        }
        currentSchema = JSON.parse(cleanedContent);
      } catch (e) {
        // If parsing fails, proceed to next iteration or fallback
      }
    }

    // Final sanity validation: if still invalid, run static heuristic fixes
    const finalValidation = validateSchema(currentSchema as ISchema);
    if (!finalValidation.valid) {
      return fixSchema(currentSchema as ISchema);
    }

    return currentSchema;
  }
}

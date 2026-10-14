// Type-check-only stand-ins for the Deno runtime that Supabase Edge Functions run on.
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

// Deno-style "npm:" imports resolve to the same packages installed here for type-checking.
declare module 'npm:stripe@23' {
  import Stripe = require('stripe');
  export = Stripe;
}
declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}
declare module 'npm:@anthropic-ai/sdk@0.133' {
  import Anthropic from '@anthropic-ai/sdk';
  export default Anthropic;
}

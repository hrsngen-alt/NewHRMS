declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
  }
  const env: Env;
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: any
  ): any;
}

declare module "npm:web-push@3.6.7" {
  const webpush: any;
  export default webpush;
}

declare module "npm:ioredis@5.4.1" {
  const Redis: any;
  export default Redis;
}


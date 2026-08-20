import { createFileRoute } from "@tanstack/react-router";

const ACCOUNTS = [
  { email: "customer.a@acme-commerce.test", name: "Customer A", role: "customer" },
  { email: "customer.b@acme-commerce.test", name: "Customer B", role: "customer" },
  { email: "employee.a@acme-commerce.test", name: "Employee A", role: "employee" },
  { email: "manager.a@acme-commerce.test", name: "Manager A", role: "manager" },
  { email: "administrator.a@acme-commerce.test", name: "Administrator A", role: "administrator" },
] as const;

export const Route = createFileRoute("/api/public/seed-test-accounts")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const password = "AcmeLab#2026";
        const results: string[] = [];

        for (const account of ACCOUNTS) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: account.email,
            password,
            email_confirm: true,
            user_metadata: { full_name: account.name },
          });
          let userId = data?.user?.id;
          if (error) {
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
            userId = list?.users.find((u) => u.email === account.email)?.id;
          }
          if (!userId) {
            results.push(`${account.email}: FAILED ${error?.message}`);
            continue;
          }
          await supabaseAdmin
            .from("profiles")
            .upsert({ id: userId, email: account.email, full_name: account.name });
          await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
          await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: userId, role: account.role });
          results.push(`${account.email}: ok (${account.role})`);
        }

        return Response.json({ results });
      },
    },
  },
});

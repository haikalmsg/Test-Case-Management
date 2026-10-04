import { requireAdmin } from "@/lib/auth";
import { assertOk } from "@/lib/actions";
import { dateLabel } from "@/lib/utils";
import {
  inviteMember,
  manageMember,
  revokeInvitation,
  saveWorkspace,
} from "@/features/team/actions";
import { ActionForm, Field } from "@/components/forms";
import { Input, Select } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared";
export default async function Team() {
  const { client } = await requireAdmin();
  // eslint-disable-next-line react-hooks/purity -- Server Component evaluates expiry once per request.
  const invitationCutoff = Date.now() - 7 * 86400000;
  const [members, invitations, settings] = await Promise.all([
    client
      .from("memberships")
      .select("*,profiles(email,full_name)")
      .order("created_at"),
    client
      .from("invitations")
      .select("*")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    client.from("workspace_settings").select("name").single(),
  ]);
  [members, invitations, settings].forEach((r) => assertOk(r.error));
  return (
    <>
      <PageHeader
        eyebrow="Workspace administration"
        title="Team & settings"
        description="Give the right people access to your team’s testing workspace."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team members</CardTitle>
              <Badge>
                {members.data?.filter((m) => m.active).length ?? 0} active
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              {members.data?.map((m) => (
                <div key={m.user_id} className="rounded-lg border p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-medium">
                        {m.profiles?.full_name || m.profiles?.email}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.profiles?.email}
                      </p>
                    </div>
                    <Badge>{m.active ? "Active" : "Removed"}</Badge>
                  </div>
                  <ActionForm
                    action={manageMember}
                    submit="Update access"
                    className="flex flex-wrap items-center gap-3"
                  >
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <Select
                      name="role"
                      aria-label={`Role for ${m.profiles?.email}`}
                      defaultValue={m.role}
                      className="w-auto"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </Select>
                    <Select
                      name="active"
                      aria-label={`Access for ${m.profiles?.email}`}
                      defaultValue={String(m.active)}
                      className="w-auto"
                    >
                      <option value="true">Active access</option>
                      <option value="false">Remove access</option>
                    </Select>
                  </ActionForm>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {invitations.data?.length ? (
                invitations.data.map((i) => (
                  <div key={i.id} className="rounded-lg border p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{i.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {i.role} · Invited {dateLabel(i.created_at)}
                        </p>
                      </div>
                      <Badge>
                        {i.revoked_at
                          ? "Revoked"
                          : new Date(i.created_at).getTime() < invitationCutoff
                            ? "Expired"
                            : "Pending"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <ActionForm
                        action={inviteMember}
                        submit="Send again"
                        variant="outline"
                      >
                        <input type="hidden" name="email" value={i.email} />
                        <input type="hidden" name="role" value={i.role} />
                      </ActionForm>
                      {!i.revoked_at ? (
                        <ActionForm
                          action={revokeInvitation}
                          submit="Revoke"
                          variant="ghost"
                          confirm="Revoke this invitation?"
                        >
                          <input type="hidden" name="id" value={i.id} />
                        </ActionForm>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No pending invitations.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invite a teammate</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={inviteMember} submit="Send invitation">
                <Field label="Email address" htmlFor="email">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="teammate@company.com"
                  />
                </Field>
                <Field label="Role" htmlFor="role">
                  <Select id="role" name="role" defaultValue="member">
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </Select>
                </Field>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Members manage cases and runs. Admins also manage projects,
                  team access, and workspace settings.
                </p>
              </ActionForm>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Workspace settings</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={saveWorkspace} submit="Save settings">
                <Field label="Workspace name" htmlFor="workspace-name">
                  <Input
                    id="workspace-name"
                    name="name"
                    defaultValue={settings.data?.name}
                    maxLength={100}
                    required
                  />
                </Field>
              </ActionForm>
            </CardContent>
          </Card>
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Your team must always have at least one active admin. Removing
            access takes effect on the next request.
          </p>
        </div>
      </div>
    </>
  );
}

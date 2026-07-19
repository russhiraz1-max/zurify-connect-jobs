import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/tickets")({
  head: () => ({ meta: [{ title: "Support tickets — Admin" }] }),
  component: AdminTickets,
});

type Ticket = { id: string; subject: string; status: string; user_id: string; created_at: string; updated_at: string; };
type Message = { id: string; author_id: string; body: string; created_at: string; is_staff_reply: boolean };

function AdminTickets() {
  const { user } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");

  async function load() {
    const { data } = await supabase.from("support_tickets")
      .select("*")
      .order("updated_at", { ascending: false }).limit(200);
    setTickets(((data ?? []) as unknown) as Ticket[]);
  }
  useEffect(() => { load(); }, []);

  async function open(id: string) {
    setOpenId(id);
    const { data } = await supabase.from("support_ticket_messages").select("*").eq("ticket_id", id).order("created_at");
    setMessages((data ?? []) as Message[]);
  }

  async function send() {
    if (!user || !openId || !reply.trim()) return;
    const { error } = await supabase.from("support_ticket_messages").insert({ ticket_id: openId, author_id: user.id, body: reply, is_staff_reply: true });
    if (error) return toast.error(error.message);
    await supabase.from("support_tickets").update({ status: "pending" as const }).eq("id", openId);
    setReply("");
    open(openId);
    load();
  }

  async function setStatus(id: string, status: "open"|"pending"|"resolved"|"closed") {
    await supabase.from("support_tickets").update({ status }).eq("id", id);
    load();
  }

  return (
    <AdminShell title="Support tickets">
      {tickets.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No tickets.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => (
            <Dialog key={t.id} open={openId === t.id} onOpenChange={o => o ? open(t.id) : setOpenId(null)}>
              <DialogTrigger asChild>
                <Card className="cursor-pointer hover:bg-accent/30">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">{t.user_id.slice(0,8)} · {dateTime(t.updated_at)}</p>
                    </div>
                    <Badge variant={t.status === "resolved" ? "default" : "secondary"}>{t.status}</Badge>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{t.subject}</DialogTitle></DialogHeader>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {messages.map(m => (
                    <div key={m.id} className={`rounded-md p-3 text-sm ${m.is_staff_reply ? "bg-primary/10" : "bg-accent"}`}>
                      <p className="whitespace-pre-line">{m.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{m.is_staff_reply ? "Staff" : "User"} · {dateTime(m.created_at)}</p>
                    </div>
                  ))}
                </div>
                <Textarea placeholder="Reply as staff…" value={reply} onChange={e => setReply(e.target.value)} />
                <div className="flex justify-between">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setStatus(t.id, "resolved")}>Mark resolved</Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus(t.id, "closed")}>Close</Button>
                  </div>
                  <Button onClick={send} disabled={!reply.trim()}>Reply</Button>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

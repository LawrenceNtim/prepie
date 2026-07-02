import { getTask, getEvent } from "@/lib/data";
import { taskToIcs } from "@/lib/ics";

export async function GET(
  _req: Request,
  { params }: { params: { taskId: string } },
) {
  const task = await getTask(params.taskId);
  if (!task) {
    return new Response("Task not found", { status: 404 });
  }
  const event = await getEvent(task.eventId);
  if (!event) {
    return new Response("Event not found", { status: 404 });
  }

  const ics = taskToIcs(task, event);
  if (!ics) {
    return new Response("Task has no resolvable date", { status: 422 });
  }

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${task.id}.ics"`,
    },
  });
}

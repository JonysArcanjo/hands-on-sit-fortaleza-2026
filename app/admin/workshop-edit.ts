export type WorkshopChanges = {
  title: string;
  instructor: string;
  room: string;
  capacity: number;
};

export function workshopChangesFromForm(form: FormData): WorkshopChanges {
  return {
    title: String(form.get("title") ?? ""),
    instructor: String(form.get("instructor") ?? ""),
    room: String(form.get("room") ?? ""),
    capacity: Number(form.get("capacity")),
  };
}

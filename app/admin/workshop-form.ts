type ResettableForm = Pick<HTMLFormElement, "reset">;

export async function finishWorkshopCreation(
  form: ResettableForm,
  reload: () => Promise<void>,
) {
  form.reset();
  await reload();
}

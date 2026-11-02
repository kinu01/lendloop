export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-2 font-semibold text-destructive" role="alert">
      {message}
    </p>
  );
}

import { Sidebar } from "@/components/docs/Sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pt-24 pb-20 px-6">
      <div className="mx-auto max-w-6xl flex gap-10">
        <Sidebar />
        <article className="min-w-0 flex-1 max-w-3xl">{children}</article>
      </div>
    </div>
  );
}

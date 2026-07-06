import Layout, { PageHeader } from "../components/Layout.jsx";
import { Card } from "../components/ui.jsx";
import { Sparkles } from "../components/Icons.jsx";

export default function Placeholder({ title, subtitle, descripcion }) {
  return (
    <Layout>
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-soft text-brand-leaf">
          <Sparkles size={26} />
        </span>
        <h3 className="font-display text-xl font-bold text-brand-dark">Próximamente</h3>
        <p className="mt-2 max-w-md text-sm text-muted">{descripcion}</p>
      </Card>
    </Layout>
  );
}

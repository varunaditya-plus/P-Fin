import { Navigation } from "@/components/layout/Navigation";

export function PageLayout(props: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navigation />
      {props.children}
    </div>
  );
}

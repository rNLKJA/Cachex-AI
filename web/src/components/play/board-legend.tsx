import { ColourDot } from "./primitives";

export function BoardLegend() {
  return (
    <dl className="bg-card/40 grid gap-3 rounded-2xl border p-4 text-sm sm:grid-cols-3">
      <div>
        <dt className="flex items-center gap-2 font-medium">
          <ColourDot colour="red" /> Red
        </dt>
        <dd className="text-muted-foreground mt-0.5">Connect the top and bottom edges.</dd>
      </div>
      <div>
        <dt className="flex items-center gap-2 font-medium">
          <ColourDot colour="blue" /> Blue
        </dt>
        <dd className="text-muted-foreground mt-0.5">Connect the left and right edges.</dd>
      </div>
      <div>
        <dt className="font-medium">Capture</dt>
        <dd className="text-muted-foreground mt-0.5">
          Close a diamond around two enemy tiles and both are removed.
        </dd>
      </div>
    </dl>
  );
}

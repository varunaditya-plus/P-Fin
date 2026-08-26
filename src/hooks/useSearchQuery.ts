import { useEffect, useState } from "react";
import { generatePath, useNavigate, useParams } from "react-router-dom";

function queryValue(query: string | null | undefined) {
  // React Router already decodes route parameters. Decoding again breaks
  // literal percent signs and changes searches containing encoded text.
  return query ?? "";
}

export function useSearchQuery(): [
  string,
  (inp: string, force?: boolean) => void,
  () => void,
] {
  const navigate = useNavigate();
  const params = useParams<{ query: string }>();
  const [search, setSearch] = useState(queryValue(params.query));

  useEffect(() => {
    setSearch(queryValue(params.query));
  }, [params.query]);

  const updateParams = (inp: string, commitToUrl = false) => {
    setSearch(inp);
    if (!commitToUrl) return;
    const current = queryValue(params.query);
    if (inp === current) return;
    if (inp.length === 0) {
      navigate("/", { replace: true });
      return;
    }
    navigate(
      generatePath("/browse/:query", {
        query: encodeURIComponent(inp),
      }),
      { replace: true },
    );
  };

  const onUnFocus = (newSearch?: string) => {
    updateParams(newSearch ?? search, true);
  };

  return [search, updateParams, onUnFocus];
}

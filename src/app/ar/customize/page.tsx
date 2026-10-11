import { permanentRedirect } from "next/navigation";

// The old "make your own" page: everything is on the menu now.
export default function Page() {
  permanentRedirect("/ar#menu");
}

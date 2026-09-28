// PROTOTYPE — throwaway entry point for issue #126. Not built or linked
// from production; see prototype-126.html at the repo root.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../styles.css";
import { PrototypeApp } from "./app";

const root = document.getElementById("root");
if (!root) {
	throw new Error("Missing #root");
}

createRoot(root).render(
	<StrictMode>
		<PrototypeApp />
	</StrictMode>,
);

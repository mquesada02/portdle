import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createPersist } from "./persist/storage";
import { App } from "./ui/app";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
	throw new Error("Missing #root");
}

createRoot(root).render(
	<StrictMode>
		<App persist={createPersist(window.localStorage)} />
	</StrictMode>,
);

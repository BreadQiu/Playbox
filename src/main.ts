import "./styles.css";
import { TwentyFourApp } from "./ui/app";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Missing application root");
}

new TwentyFourApp(root);

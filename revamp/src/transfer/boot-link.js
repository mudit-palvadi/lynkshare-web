import { takeBootFragment } from "../engine/index.js";

const href = takeBootFragment();

export const bootFragment = href ? new URL(href).hash : "";

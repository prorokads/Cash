import { createApp } from "./app.mjs";
const production = process.env.NODE_ENV === "production";
const { app } = createApp({ production });
const port = Number(process.env.PORT || 3001);
app.listen(port, "127.0.0.1", () =>
  console.log(`CASH API: http://127.0.0.1:${port}`),
);

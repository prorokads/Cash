export type Project = {
  name: string;
  client: string;
  service: string;
  quantity: number;
  addons: string[];
  functions: string[];
  urgency: string;
  discount: number;
  notes: string;
  rates: Record<string, number>;
};
export type User = { id: number; name: string; email: string };
export type Estimate = {
  id: string;
  project: Project;
  total: number;
  created: string;
  updated: string;
};

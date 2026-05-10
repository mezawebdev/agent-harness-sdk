/** Case-conversion helpers for CLI scaffolders. */

export const isKebabCase = (s: string): boolean =>
  /^[a-z]+(-[a-z]+)*$/.test(s);

export const kebabToCamel = (s: string): string =>
  s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export const kebabToSnake = (s: string): string => s.replaceAll("-", "_");

export const kebabToPascal = (s: string): string => {
  const camel = kebabToCamel(s);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};

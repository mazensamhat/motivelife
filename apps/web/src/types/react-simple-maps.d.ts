declare module "react-simple-maps" {
  import type { ReactNode, CSSProperties } from "react";

  export interface Geography {
    rsmKey: string;
    id: string | number;
    properties: Record<string, unknown>;
    [key: string]: unknown;
  }

  export function ComposableMap(props: {
    projection?: string;
    projectionConfig?: Record<string, number | number[]>;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
  }): JSX.Element;

  export function Geographies(props: {
    geography: string | object;
    children: (args: { geographies: Geography[] }) => ReactNode;
  }): JSX.Element;

  export function Geography(props: {
    geography: Geography;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: Record<string, CSSProperties>;
  }): JSX.Element;

  export function Marker(props: {
    coordinates: [number, number];
    children?: ReactNode;
  }): JSX.Element;

  export function Sphere(props: {
    id?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  }): JSX.Element;

  export function Graticule(props: {
    stroke?: string;
    strokeWidth?: number;
  }): JSX.Element;
}

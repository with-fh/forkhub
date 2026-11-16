declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      "relative-time": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        dateTime?: string;
        title?: string;
      };
    }
  }
}

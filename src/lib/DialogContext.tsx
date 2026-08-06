import React from "react";

export const DialogContext = React.createContext<boolean>(false);

export function useIsInsideDialog() {
  return React.useContext(DialogContext);
}

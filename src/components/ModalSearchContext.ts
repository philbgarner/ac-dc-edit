import { createContext, useContext } from "react";

export interface ModalCtx {
  filter: string;
  forceExpand: number;
  forceCollapse: number;
}

export const ModalSearchContext = createContext<ModalCtx>({
  filter: "",
  forceExpand: 0,
  forceCollapse: 0,
});

export const useModalSearch = () => useContext(ModalSearchContext);

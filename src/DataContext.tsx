import { createContext, useContext, useState, ReactNode } from 'react'
import { createGame } from 'atomic-core'

type GameInstance = ReturnType<typeof createGame>

interface DataContextValue {
  game: GameInstance | null
  setGame: (game: GameInstance) => void
}

const DataContext = createContext<DataContextValue>({
  game: null,
  setGame: () => {},
})

export function DataProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<GameInstance | null>(null)

  return (
    <DataContext.Provider value={{ game, setGame }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}

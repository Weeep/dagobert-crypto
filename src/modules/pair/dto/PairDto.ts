import type { DagobertPair } from "../domain/DagobertPair";

/** Stable JSON representation exposed by the pair HTTP API. */
export type PairDto = {
  pair: string;
  decimals: number;
  keyLevels: number[];
};

export function toPairDto(pair: DagobertPair): PairDto {
  return {
    pair: pair.pair,
    decimals: pair.decimals,
    keyLevels: pair.keyLevels,
  };
}

export function fromPairDto(dto: PairDto): DagobertPair {
  return {
    pair: dto.pair,
    decimals: dto.decimals,
    keyLevels: dto.keyLevels,
  };
}

import type { NextApiRequest, NextApiResponse } from "next";
import type { DagobertTransactionGroup } from "../../domain/DagobertTransactionGroup";
import {
  toTransactionGroupDto,
  type TransactionGroupDto,
} from "../../dto/TransactionGroupDto";
import type { ReadApiResponse } from "@/src/shared/dto/ReadApiResponse";
import {
  getSingleQueryValue,
  rejectNonGetMethod,
  sendReadApiError,
} from "@/src/shared/infrastructure/http/readApiHelpers";

export type TransactionGroupsReadUseCases = {
  listTransactionGroups: {
    execute(): Promise<DagobertTransactionGroup[]>;
  };
  getTransactionGroup: {
    execute(id: string): Promise<
      | { ok: true; transactionGroup: DagobertTransactionGroup }
      | { ok: false; error: string; transactionGroup: null }
    >;
  };
};

export function createTransactionGroupsReadHandler(
  useCases: TransactionGroupsReadUseCases
) {
  return async function transactionGroupsReadHandler(
    req: NextApiRequest,
    res: NextApiResponse<ReadApiResponse<TransactionGroupDto | TransactionGroupDto[]>>
  ): Promise<void> {
    if (req.method !== "GET") {
      rejectNonGetMethod(res);
      return;
    }

    try {
      const id = getSingleQueryValue(req.query.id);
      if (!id) {
        const groups = await useCases.listTransactionGroups.execute();
        res.status(200).json({ data: groups.map(toTransactionGroupDto) });
        return;
      }

      const result = await useCases.getTransactionGroup.execute(id);
      if (!result.ok) {
        sendReadApiError(res, 404, "NOT_FOUND", result.error);
        return;
      }

      res.status(200).json({ data: toTransactionGroupDto(result.transactionGroup) });
    } catch {
      sendReadApiError(
        res,
        500,
        "INTERNAL_ERROR",
        "Failed to read transaction groups"
      );
    }
  };
}

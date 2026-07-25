import type { NextApiRequest, NextApiResponse } from "next";
import type { DagobertTransactionGroup } from "../../domain/DagobertTransactionGroup";
import {
  toTransactionGroupDto,
  fromTransactionGroupDto,
  type TransactionGroupDto,
} from "../../dto/TransactionGroupDto";
import type { ReadApiResponse } from "@/src/shared/dto/ReadApiResponse";
import {
  getSingleQueryValue,
  rejectNonGetMethod,
  sendReadApiError,
} from "@/src/shared/infrastructure/http/readApiHelpers";
import type { TransactionGroupRepository } from "../../domain/TransactionGroupRepository";
import { isRecord, rejectUnsupportedMethod, sendBadRequest } from "@/src/shared/infrastructure/http/writeApiHelpers";

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
  useCases: TransactionGroupsReadUseCases,
  repository?: Pick<TransactionGroupRepository, "save" | "delete">
) {
  return async function transactionGroupsReadHandler(
    req: NextApiRequest,
    res: NextApiResponse<ReadApiResponse<TransactionGroupDto | TransactionGroupDto[] | null>>
  ): Promise<void> {
    if (!repository && req.method !== "GET") {
      rejectNonGetMethod(res);
      return;
    }
    if (repository && !["GET", "PUT", "DELETE"].includes(req.method ?? "")) {
      rejectUnsupportedMethod(res, ["GET", "PUT", "DELETE"]);
      return;
    }

    try {
      const id = getSingleQueryValue(req.query.id);
      if (req.method === "PUT") {
        if (!id || !isTransactionGroupDto(req.body) || req.body.groupId !== id) {
          sendBadRequest(res, "A valid transaction group matching the URL id is required");
          return;
        }
        const group = fromTransactionGroupDto(req.body);
        await repository!.save(group);
        res.status(200).json({ data: toTransactionGroupDto(group) });
        return;
      }
      if (req.method === "DELETE") {
        if (!id) {
          sendBadRequest(res, "Transaction group id is required");
          return;
        }
        await repository!.delete(id);
        res.status(200).json({ data: null });
        return;
      }
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
        req.method === "GET"
          ? "Failed to read transaction groups"
          : "Failed to write transaction groups"
      );
    }
  };
}

function isTransactionGroupDto(value: unknown): value is TransactionGroupDto {
  return isRecord(value) && typeof value.groupId === "string" &&
    typeof value.pair === "string" && Array.isArray(value.groupedTrans);
}

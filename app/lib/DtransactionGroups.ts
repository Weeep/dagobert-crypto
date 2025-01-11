import { DagobertTransactionGroup, KVRoot } from "@/utils/typesAndEnums";
import { v4 as uuidv4 } from "uuid";
import ClientSideDbCache from "./ClientSideDbCache";

class DtransactionGroups {
  static async post(transactionGroups: DagobertTransactionGroup[]): Promise<{
    ok: boolean;
    error: any;
    response: {
      groupedTransactions: DagobertTransactionGroup[];
    } | null;
  }> {
    if (!transactionGroups || transactionGroups === undefined) {
      //? TODO true even it is undefined ?
      return { ok: false, error: "Missing data", response: null };
    }

    if (
      transactionGroups.length > 0 &&
      transactionGroups[0]?.pair &&
      transactionGroups[0]?.groupedTrans
    ) {
      for (const transactionGroup of transactionGroups) {
        for (const dtransaction of transactionGroup.groupedTrans) {
          const storedTransaction = ClientSideDbCache.hget(
            KVRoot.dtransactions,
            dtransaction.orderId.toString()
          );

          const newGroupedValue = { grouped: true };

          await ClientSideDbCache.hset(KVRoot.dtransactions, {
            [dtransaction.orderId]: {
              ...storedTransaction,
              ...newGroupedValue,
            },
          });
        }

        const gid = uuidv4();
        transactionGroup.groupId = gid;
        await ClientSideDbCache.hset(KVRoot.dtransactionGroups, {
          [gid]: transactionGroup,
        });
      }
    } else {
      return {
        ok: false,
        error: "Invalid data: " + JSON.stringify(transactionGroups),
        response: null,
      };
    }

    return {
      ok: true,
      error: "",
      response: {
        groupedTransactions: transactionGroups,
      },
    };
  }

  static get(id: string | null): {
    ok: boolean;
    error: any;
    response: {
      groupedTransactions: DagobertTransactionGroup[];
    } | null;
  } {
    // --- getTransactionGroups
    let tranGroups: any;

    if (id) {
      tranGroups = ClientSideDbCache.hget(
        KVRoot.dtransactionGroups,
        id as string
      );
    } else {
      tranGroups = ClientSideDbCache.hgetall(KVRoot.dtransactionGroups);
    }

    if (tranGroups !== null) {
      if (id) {
        return { ok: true, error: "", response: tranGroups };
      } else {
        let filteredTransactionGroups: DagobertTransactionGroup[] =
          Object.values(tranGroups) as DagobertTransactionGroup[];

        return {
          ok: true,
          error: "",
          response: { groupedTransactions: filteredTransactionGroups },
        };
      }
    } else {
      return { ok: false, error: "No transaction groups", response: null };
    }
  }
}

export default DtransactionGroups;

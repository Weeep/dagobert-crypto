import {
  DagobertTransaction,
  DagobertTransactionGroup,
  KVRoot,
} from "@/utils/typesAndEnums";
import { v4 as uuidv4 } from "uuid";
import ClientSideDbCache from "./ClientSideDbCache";
import Dtransactions from "./Dtransactions";

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
        const gid = uuidv4();
        transactionGroup.groupId = gid;
        const success: boolean = await ClientSideDbCache.hset(
          KVRoot.dtransactionGroups,
          {
            [gid]: transactionGroup,
          }
        );

        if (success) {
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
        }
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

  static getAll(): DagobertTransactionGroup[] | null {
    let tranGroups = ClientSideDbCache.hgetall(KVRoot.dtransactionGroups);

    if (tranGroups === null) return null;

    return Object.values(tranGroups) as DagobertTransactionGroup[];
  }

  static get(id: string): DagobertTransactionGroup | null {
    if (!id) return null;

    return ClientSideDbCache.hget(
      KVRoot.dtransactionGroups,
      id as string
    ) as DagobertTransactionGroup;
  }

  static async del(groupId: string): Promise<boolean> {
    const groupedDts = this.get(groupId)?.groupedTrans;

    if (!groupedDts) {
      console.error("No group with id: " + groupId);
      return false;
    }

    const dTransIds = groupedDts.map((dt) => dt.orderId);
    const dTranss = dTransIds.map((id) => Dtransactions.get(id));
    for (const dt of dTranss) {
      const newGroupedValue = { grouped: false };
      await ClientSideDbCache.hset(KVRoot.dtransactions, {
        [dt.orderId]: {
          ...dt,
          ...newGroupedValue,
        },
      });
    }

    ///check
    //const dTranss2 = dTransIds
    //  .map((id) => Dtransactions.get(id))
    //  .map((dt) => [dt.orderId, dt.grouped]);
    //console.log(JSON.stringify(dTranss2));
    ///

    const success = await ClientSideDbCache.hdel(
      KVRoot.dtransactionGroups,
      groupId
    );

    ///check
    //const dgroup = this.get(groupId);
    //console.log("eeeeeeee " + success + ", " + JSON.stringify(dgroup));

    return success;
  }
}

export default DtransactionGroups;

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aiApi } from '../../lib/ai-api';
export function AIReportSummary({
  period,
  version,
  hasData,
}: {
  period: '7天' | '30天' | '本月' | '全部';
  version: number;
  hasData: boolean;
}) {
  const [requested, setRequested] = useState(false);
  const query = useQuery({
    queryKey: ['ai-report', period, version],
    queryFn: () => aiApi.summarize(period),
    enabled: requested && hasData,
    staleTime: Infinity,
    retry: false,
  });
  if (!hasData) return null;
  return (
    <section className="ai-summary">
      <button
        className="outline-button full-width"
        disabled={query.isFetching}
        onClick={() => {
          setRequested(true);
          if (query.isError) void query.refetch();
        }}
      >
        {query.isFetching
          ? '正在写成长回顾…'
          : query.isError
            ? '重新生成回顾'
            : query.data
              ? '成长回顾已生成'
              : '生成 AI 成长回顾'}
      </button>
      {query.data && <p>{query.data.summary}</p>}
      {query.isError && (
        <p className="small-print" role="alert">
          {query.error.message}，统计数据仍可查看。
        </p>
      )}
    </section>
  );
}

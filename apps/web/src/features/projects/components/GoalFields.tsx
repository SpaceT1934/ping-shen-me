import type { GoalInput } from '@apple/contracts';
export const defaultGoal: GoalInput = { title: '', type: 'count', target: 10, unit: '' };
export function GoalFields({
  value,
  onChange,
  required = true,
}: {
  value: GoalInput;
  onChange: (value: GoalInput) => void;
  required?: boolean;
}) {
  return (
    <div className="goal-fields">
      <label>
        阶段目标
        <input
          aria-label="阶段目标"
          placeholder="比如：发布 10 条视频"
          value={value.title}
          maxLength={200}
          required={required}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
      </label>
      <label>
        完成方式
        <select
          aria-label="完成方式"
          value={value.type}
          onChange={(event) => {
            const type = event.target.value as GoalInput['type'];
            onChange({
              ...value,
              type,
              target: type === 'percentage' ? 100 : type === 'manual' ? 1 : 10,
              unit: type === 'percentage' ? '%' : '',
            });
          }}
        >
          <option value="count">数量目标</option>
          <option value="percentage">百分比目标</option>
          <option value="manual">手动确认完成</option>
        </select>
      </label>
      {value.type === 'count' && (
        <div className="form-grid">
          <label>
            目标数量
            <input
              aria-label="目标数量"
              type="number"
              min="1"
              max="1000000000"
              step="1"
              value={value.target}
              onChange={(event) => onChange({ ...value, target: Number(event.target.value) })}
              required
            />
          </label>
          <label>
            单位
            <input
              aria-label="目标单位"
              placeholder="条、次、天…"
              value={value.unit}
              maxLength={30}
              onChange={(event) => onChange({ ...value, unit: event.target.value })}
            />
          </label>
        </div>
      )}
      <p className="small-print">
        {value.type === 'manual'
          ? '达成时由你确认，不根据行动次数自动判断。'
          : '行动成长与目标进度分别计算，进度请在项目详情中明确更新。'}
      </p>
    </div>
  );
}

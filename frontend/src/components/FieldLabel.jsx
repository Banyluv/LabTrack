import InfoTooltip from './InfoTooltip';

export default function FieldLabel({ label, tip, required, className = '' }) {
  return (
    <label className={`label flex items-center gap-1.5 ${className}`}>
      {label}
      {required && <span className="text-red-400 text-xs">*</span>}
      {tip && <InfoTooltip text={tip} />}
    </label>
  );
}

import { cn } from "@/lib/utils";

type ProgressProps = React.ComponentProps<"div"> & {
  value?: number;
  indeterminate?: boolean;
};

function Progress({
  className,
  value = 0,
  indeterminate = false,
  ...props
}: ProgressProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full bg-primary transition-all",
          indeterminate && "animate-pulse w-full",
        )}
        style={indeterminate ? undefined : { width: `${value}%` }}
      />
    </div>
  );
}

export { Progress };

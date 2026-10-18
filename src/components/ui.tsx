import {
  AlertCircle,
  ArrowLeft,
  Inbox,
  LockKeyhole,
  RotateCcw,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export type TagTone = "neutral" | "primary" | "success" | "warning" | "danger";

const tagToneClasses: Record<TagTone, string> = {
  neutral: "",
  primary: "badge--brand",
  success: "badge--success",
  warning: "badge--warning",
  danger: "badge--danger",
};

export function Tag({
  as = "span",
  tone = "neutral",
  className = "",
  children,
}: {
  as?: "span" | "li";
  tone?: TagTone;
  className?: string;
  children: ReactNode;
}) {
  const classes = ["badge", tagToneClasses[tone], className].filter(Boolean).join(" ");
  return as === "li" ? (
    <li className={classes}>{children}</li>
  ) : (
    <span className={classes}>{children}</span>
  );
}

export function RadioGroup<Value extends string>({
  label,
  name,
  value,
  options,
  className = "",
  onChange,
}: {
  label: string;
  name?: string;
  value: Value;
  options: ReadonlyArray<{ value: Value; label: string }>;
  className?: string;
  onChange: (value: Value) => void;
}) {
  const generatedName = useId();
  const inputName = name ?? generatedName;

  return (
    <div className={`radio-group-row ${className}`.trim()} role="radiogroup" aria-label={label}>
      <span className="radio-group-row__label">{label}</span>
      <div className="radio-group-row__options">
        {options.map((option) => (
          <label className="radio-group-option" key={option.value}>
            <input
              checked={value === option.value}
              name={inputName}
              type="radio"
              value={option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  back = false,
  leadingAction,
}: {
  title: string;
  description?: ReactNode;
  back?: boolean;
  leadingAction?: ReactNode;
}) {
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const scrollContainer = headerRef.current?.closest<HTMLElement>("#main-content");
    if (!scrollContainer) return;

    let wasScrolled = false;
    const updateScrolledState = () => {
      const nextScrolled = scrollContainer.scrollTop > 0;
      if (nextScrolled === wasScrolled) return;
      wasScrolled = nextScrolled;
      setIsScrolled(nextScrolled);
    };

    updateScrolledState();
    scrollContainer.addEventListener("scroll", updateScrolledState, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", updateScrolledState);
  }, []);

  return (
    <header ref={headerRef} className={`page-header${isScrolled ? " is-scrolled" : ""}`}>
      <div className="cluster gap-12 min-w-0">
        {leadingAction}
        {back ? (
          <button
            className="icon-button"
            type="button"
            onClick={() => navigate(-1)}
            aria-label="返回"
          >
            <ArrowLeft aria-hidden="true" />
          </button>
        ) : null}
        <div className="min-w-0">
          <h1>{title}</h1>
          {description ? <p className="muted text-sm text-clamp-2">{description}</p> : null}
        </div>
      </div>
    </header>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`section stack gap-12 ${className}`.trim()}>
      {title || action ? (
        <div className="section-heading cluster spread gap-12">
          <div className="min-w-0">
            {title ? <h2>{title}</h2> : null}
            {description ? <div className="muted text-sm text-pretty">{description}</div> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DataRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="data-row">
      <div className="min-w-0">
        <p className="data-row__label">{label}</p>
        {detail ? <div className="data-row__detail">{detail}</div> : null}
      </div>
      <div className="data-row__value">{value}</div>
    </div>
  );
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="stack gap-12" aria-label="正在加载" role="status">
      <div className="skeleton skeleton--title" />
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <div className="skeleton skeleton--icon" />
          <div className="stack gap-8 flex-1">
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line skeleton--short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "页面加载失败，请稍后重试。";
  return (
    <div className="state-panel" role="alert">
      <AlertCircle aria-hidden="true" />
      <h2>暂时无法加载</h2>
      <p>{message}</p>
      {onRetry ? (
        <button className="button button--secondary" type="button" onClick={onRetry}>
          <RotateCcw aria-hidden="true" />
          重新加载
        </button>
      ) : null}
    </div>
  );
}

interface QueryStateSource<T> {
  data: T | undefined;
  error: unknown;
  isError: boolean;
  isPending: boolean;
  refetch: () => unknown;
}

export function QueryState<T>({
  query,
  children,
  loadingRows = 3,
}: {
  query: QueryStateSource<T>;
  children: (data: T) => ReactNode;
  loadingRows?: number;
}) {
  if (query.data !== undefined) {
    return (
      <>
        {children(query.data)}
        {query.isError ? (
          <PageError error={query.error} onRetry={() => void query.refetch()} />
        ) : null}
      </>
    );
  }
  if (query.isPending) return <PageSkeleton rows={loadingRows} />;
  if (query.isError) {
    return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  }
  return null;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="state-panel">
      <Icon aria-hidden="true" />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function AuthPrompt({
  title = "登录后查看",
  description = "这里包含你的个人校园数据，登录后即可继续。",
  headingLevel = 2,
}: {
  title?: string;
  description?: string;
  headingLevel?: 2 | 3;
}) {
  const { pathname, search, hash } = useLocation();
  const returnTo = `${pathname}${search}${hash}`;

  return (
    <div className="auth-prompt">
      <LockKeyhole aria-hidden="true" />
      {headingLevel === 3 ? <h3>{title}</h3> : <h2>{title}</h2>}
      <p>{description}</p>
      <Link className="button button--text" to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
        去登录
      </Link>
    </div>
  );
}

export function StatusMessage({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  return (
    <p className={`status-message status-message--${tone}`} aria-live="polite">
      {children}
    </p>
  );
}

export function Modal({
  title,
  description,
  bodyLabel,
  children,
  onClose,
  variant = "default",
  showClose = true,
}: {
  title: string;
  description?: string;
  bodyLabel?: string;
  children: ReactNode;
  onClose: () => void;
  variant?: "default" | "confirmation" | "course-detail";
  showClose?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeFromBackdrop(event: ReactMouseEvent<HTMLDialogElement>) {
    if (variant === "course-detail") {
      const target = event.target;
      const isTransparentSpace =
        target === event.currentTarget ||
        (target instanceof HTMLElement && target.classList.contains("modal__body"));
      if (isTransparentSpace) onClose();
      return;
    }

    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const insideDialog =
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom;
    if (!insideDialog) onClose();
  }

  useEffect(() => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (triggerRef.current?.isConnected) {
        triggerRef.current.focus();
      } else {
        const heading = document.querySelector<HTMLHeadingElement>("#main-content h1");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus();
        }
      }
    };
  }, []);

  return (
    <dialog
      className={`modal modal--${variant}`}
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={closeFromBackdrop}
      onKeyDown={trapFocus}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal__header cluster spread gap-12">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? (
            <p className="muted text-sm" id={descriptionId}>
              {description}
            </p>
          ) : null}
        </div>
        {showClose ? (
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div
        className="modal__body"
        role={bodyLabel ? "region" : undefined}
        aria-label={bodyLabel}
        tabIndex={bodyLabel ? 0 : undefined}
      >
        {children}
      </div>
    </dialog>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const close = () => {
    if (!pending) onCancel();
  };

  return (
    <Modal
      title={title}
      description={description}
      onClose={close}
      variant="confirmation"
      showClose={false}
    >
      {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
      <div className="modal__actions">
        <button className="button button--tonal" type="button" disabled={pending} onClick={close}>
          取消
        </button>
        <button
          className="button button--danger"
          type="button"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? "处理中…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

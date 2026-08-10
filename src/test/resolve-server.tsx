import { Children, isValidElement, type ReactNode } from 'react';

/**
 * Resolve an async Server Component tree into plain elements.
 *
 * Testing Library renders on the client, where an `async function` component is
 * not something React can resolve — it returns a promise, React has nothing to
 * do with it, and the surrounding tree renders EMPTY. That is a silent failure:
 * the test does not throw, it just asserts against an empty container.
 *
 * The alternative to this helper is testing every composed server surface only
 * through Playwright, which would push the assertions that matter most here —
 * "no placeholder ever appears where a figure belongs" — into a browser, slowly,
 * once per route.
 *
 * So this walks the tree and awaits every function component it meets, handing
 * back something Testing Library can render synchronously. Client components
 * (`'use client'`) are left alone: they are ordinary React by the time they get
 * here.
 */
export async function resolveServer(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) {
    return Promise.all(node.map(child => resolveServer(child)));
  }

  if (!isValidElement(node)) return node;

  const props = node.props as Record<string, unknown>;

  /*
   * ONLY async functions are resolved, and the discriminator is deliberate.
   *
   * Every Server Component in this codebase is an `async function`; every
   * client leaf (`CountUp`, `ThemeToggle`, `MobileNav`) is a sync function
   * that calls hooks. Calling a hook-using component as a plain function throws
   * "Invalid hook call", so descending into everything would break exactly the
   * components React is perfectly capable of rendering itself.
   *
   * So sync components are left in the tree untouched and React renders them
   * normally, which is also what makes their own behaviour testable here.
   */
  if (
    typeof node.type === 'function' &&
    node.type.constructor.name === 'AsyncFunction'
  ) {
    const component = node.type as (
      props: Record<string, unknown>
    ) => Promise<ReactNode>;
    return resolveServer(await component(props));
  }

  if (props.children === undefined) return node;

  const children = await Promise.all(
    Children.toArray(props.children as ReactNode).map(child =>
      resolveServer(child)
    )
  );

  return { ...node, props: { ...props, children } } as ReactNode;
}

"""Remove top-level `function NAME(...){...}` declarations from a JS file
(brace-matched, string/comment aware enough for this codebase)."""
import re, sys

def find_end(src, start):
    i = src.index("{", start)
    depth = 0; n = len(src); q = None
    while i < n:
        c = src[i]
        if q:
            if c == "\\": i += 2; continue
            if q == "`" and c == "$" and src[i+1] == "{":
                # template expression: count braces inside
                depth += 1; i += 2; q_stack.append("`"); q = None; continue
            if c == q: q = None
        else:
            if c in "\"'`": q = c
            elif c == "/" and src[i+1] == "*": i = src.index("*/", i) + 2; continue
            elif c == "/" and src[i+1] == "/": i = src.index("\n", i); continue
            elif c == "{": depth += 1
            elif c == "}":
                depth -= 1
                if q_stack and depth >= 0 and q_stack_depth_ok(depth):
                    pass
                if depth == 0: return i + 1
                if q_stack and depth == template_depths[-1]:
                    template_depths.pop(); q = q_stack.pop(); 
        i += 1
    raise ValueError("unbalanced")

q_stack = []; template_depths = []
def q_stack_depth_ok(d): return True

def remove(src, name):
    m = re.search(r"(?m)^function %s\(" % re.escape(name), src)
    if not m: raise SystemExit("not found: " + name)
    end = find_end_simple(src, m.start())
    # also drop the newline after
    if end < len(src) and src[end] == "\n": end += 1
    return src[:m.start()] + src[end:]

def find_end_simple(src, start):
    """Track braces, skipping strings/template literals (with ${} nesting) and comments."""
    j = src.index("(", start); par = 0
    while True:
        if src[j] == "(": par += 1
        elif src[j] == ")":
            par -= 1
            if par == 0: break
        j += 1
    i = src.index("{", j); n = len(src)
    stack = []  # modes: '{' code block, '`' template, '${' template expr
    mode_stack = ["code"]; depth = 0
    while i < n:
        c = src[i]; mode = mode_stack[-1]
        if mode == "tpl":
            if c == "\\": i += 2; continue
            if c == "`": mode_stack.pop(); i += 1; continue
            if c == "$" and i + 1 < n and src[i+1] == "{": mode_stack.append("expr"); stack.append(0); i += 2; continue
            i += 1; continue
        if mode in ("sq", "dq"):
            if c == "\\": i += 2; continue
            if (mode == "sq" and c == "'") or (mode == "dq" and c == '"'): mode_stack.pop()
            i += 1; continue
        # code or expr
        if c == "/" and src[i+1] == "*": i = src.index("*/", i) + 2; continue
        if c == "/" and src[i+1] == "/": i = src.index("\n", i); continue
        if c == "`": mode_stack.append("tpl"); i += 1; continue
        if c == "'": mode_stack.append("sq"); i += 1; continue
        if c == '"': mode_stack.append("dq"); i += 1; continue
        if c == "{":
            if mode == "expr": stack[-1] += 1
            else: depth += 1
        elif c == "}":
            if mode == "expr":
                if stack[-1] == 0: stack.pop(); mode_stack.pop()
                else: stack[-1] -= 1
            else:
                depth -= 1
                if depth == 0: return i + 1
        i += 1
    raise ValueError("unbalanced from %d" % start)

if __name__ == "__main__":
    path = sys.argv[1]; names = sys.argv[2:]
    src = open(path).read()
    for nm in names: src = remove(src, nm)
    open(path, "w").write(src)
    print("removed", len(names))

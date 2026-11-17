#!/usr/bin/env python3
"""Fail the Hugo build if TeX delimiters leak into visible article text."""

from html.parser import HTMLParser
from pathlib import Path
import sys

VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input",
             "link", "meta", "param", "source", "track", "wbr"}
IGNORED_TAGS = {"code", "pre", "math", "script", "style", "textarea"}
DELIMITERS = ("$$", r"\(", r"\)", r"\[", r"\]")


class ArticleMathParser(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.stack = []
        self.post_depth = 0
        self.ignore_depth = 0
        self.errors = []
        self.math_count = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = (attrs.get("class") or "").split()
        is_post = tag in {"div", "article", "section"} and "post-content" in classes
        is_ignored = tag in IGNORED_TAGS

        if is_post:
            self.post_depth += 1
        if is_ignored and self.post_depth:
            self.ignore_depth += 1
        if tag == "math" and self.post_depth:
            self.math_count += 1

        if tag not in VOID_TAGS:
            self.stack.append((tag, is_post, is_ignored and self.post_depth > 0))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                removed = self.stack[index:]
                del self.stack[index:]
                for _, is_post, is_ignored in reversed(removed):
                    if is_ignored:
                        self.ignore_depth -= 1
                    if is_post:
                        self.post_depth -= 1
                return

    def handle_data(self, data):
        if self.post_depth and not self.ignore_depth:
            for delimiter in DELIMITERS:
                if delimiter in data:
                    self.errors.append(delimiter)


def main(root):
    pages = sorted(Path(root).rglob("*.html"))
    checked = 0
    failures = []
    for page in pages:
        parser = ArticleMathParser(page)
        parser.feed(page.read_text(encoding="utf-8", errors="replace"))
        if parser.math_count or parser.errors:
            checked += 1
        if parser.errors:
            failures.append((page, sorted(set(parser.errors))))

    if failures:
        for page, delimiters in failures:
            print(f"Unrendered math delimiters in {page}: {', '.join(delimiters)}")
        raise SystemExit(1)

    print(f"Math rendering check passed: scanned {len(pages)} HTML files; "
          f"{checked} article pages contain rendered MathML and no visible raw delimiters.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: check_math_rendering.py <hugo-public-directory>")
    main(sys.argv[1])

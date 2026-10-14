export const SAMPLE_DOC = `# 数学排版示例

这是一段**加粗文字**和*斜体文字*，还有删除线、[链接](https://www.zhihu.com)、以及行内代码 \`x = f(y)\`。

行内公式长得像这样：欧拉公式 $e^{i\\pi} + 1 = 0$ 十分优美；方差 $\\sigma^2 = \\frac{1}{n}\\sum_{i=1}^n (x_i - \\bar{x})^2$ 也是。

## 行间公式

$$
\\int_{-\\infty}^{+\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
$$

多行对齐也没有问题：

$$
\\begin{aligned}
\\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\varepsilon_0} \\\\
\\nabla \\times \\mathbf{B} &= \\mu_0 \\mathbf{J} + \\mu_0\\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}
\\end{aligned}
$$

## 引用与列表

> 排版是思想的衣服。好的排版让读者把注意力放在内容本身。

1. 支持**有序列表**
2. 支持*嵌套结构*
   - 二级条目
   - 数学 $\\alpha, \\beta, \\gamma$

## 表格

| 函数 | 导数 | 积分 |
| --- | --- | --- |
| $\\sin x$ | $\\cos x$ | $-\\cos x + C$ |
| $e^x$ | $e^x$ | $e^x + C$ |

## 代码块

\`\`\`python
import numpy as np

def heat(u, dx, dt, steps):
    """一维热方程显式差分"""
    for _ in range(steps):
        u[1:-1] += dt / dx**2 * (u[2:] - 2*u[1:-1] + u[:-2])
    return u
\`\`\`

---

把这篇文章切换到「公众号」或「知乎」，点右上角复制，直接粘贴进对应编辑器即可。
`;

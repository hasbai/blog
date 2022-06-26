---
title: Shamir秘密共享算法与实践
date: 2022-06-26
categories:
 - 码言
tags:
 - 密码学
 - python
---

如何把秘密 s 分享给 n 个人，使得其中任意 t 个人联合就可以还原出 s，而任意少于 t 人的组合则不能还原？

<!-- more -->

 Adi Shamir（1979）提出了著名的 Shamir 秘密共享算法，其原理基于拉格朗日插值法。

对于门限值（threshold）$t \space (t \le n)$，构造 t-1 阶多项式
$$
f(x) = a_0 + a_1x + a_2x^2 + ... + a_{t-1}x^{t-1}
$$
其中，$a_0$ 即为我们要保护的秘密值，$a_1, ..., a_{t-1}$ 为随机选取的整数。选择 n 个 x 即可生成 n 个密钥对 $(x_1, y_1), (x_2, y_2), ..., (x_n, y_n)$。

若要从 k 个密钥对中还原出秘密 $a_0$，相当于解方程 $X \boldsymbol a = \boldsymbol y$，其中 $X$ 为 $k \times t$ 的范德蒙矩阵
$$
X =
\begin{pmatrix}
1 & x_1 & \cdots & x_1^{t-1} \\
1 & x_2 & \cdots & x_2^{t-1} \\
\vdots & \vdots & \ddots & \vdots \\
1 & x_k & \cdots & x_k^{t-1} \\
\end{pmatrix}
$$
可见，只有当 $k \ge t$ 时，$\boldsymbol a$ 才有唯一解，否则有无穷多解。

对 $a_0$ 的计算可以使用拉格朗日插值公式，只需计算 $L(0)$ 即可：
$$
L(x)=\sum_{i=1}^t y_i \prod_{j=1 \atop j \neq i}^t \dfrac {x - x_j} {x_i - x_j} \\
a_0 = L(0)=\sum_{i=1}^t y_i \prod_{j=1 \atop j \neq i}^t \dfrac {x_j} {x_j - x_i} \\
$$
很快可以写出如下的代码：

```python
def generate(secret: int, num: int, threshold: int) -> np.ndarray:
    coefficient = np.zeros(threshold)
    coefficient[0] = secret
    for i in range(threshold - 1):
        coefficient[i + 1] = secrets.randbelow(1145141919810)
    vander = np.vander(np.arange(1, num + 1), threshold, increasing=True)
    return vander.dot(coefficient)

def lagrange(x: np.ndarray, y: np.ndarray) -> int:
    if len(x) != len(y):
        raise ValueError('x must be the same length as y')
    s = 0
    for i in range(len(y)):
        pi = 1
        for j in range(len(y)):
            if i == j:
                continue
            pi *= - x[j] / (x[i] - x[j])
        s += y[i] * pi
    s = round(s)
    return s
```

这样的实现存在几个问题：

第一，在生成密钥时为了简便，直接计算了矩阵，空间复杂度高。

第二，numpy 的底层数据类型为 int 或者 long，大数计算时会溢出。

第三，存在安全问题。假设攻击者获取了 t - 1 个密钥，他就可以将 $a_0$ 表示为 $a_0 = p + q * a_{t-1}$ 的形式，由于系数都是正整数，$a_{t-1}$ 的范围可以由 t - 1 个方程给出，因此  $a_0$ 就可以被缩小到有限范围内了。

因此，上述的计算需要在有限域 $GF(P)$ 上进行，这里 P 可以取大素数，比如 $2^{521} -1$ 。在有限域中，四则运算变为模运算，（1）式应该改写为下式，并确保 $a_i < P$ .
$$
f(x) = a_0 + a_1x + a_2x^2 + ... + a_{t-1}x^{t-1} \quad  mod P
$$
这样，获得 t - 1 个密钥的攻击者只能将 $a_0$ 表示为 $a_0 = p + q * a_{t-1} + m * P$ 的形式，其中 m 可以为任意整数，因此很难猜测出秘密 $a_0$ ，算法的安全性可以得到保证。

修改后的代码如下：

```python
P = 2 ** 521 - 1  # the 13th Mersenne prime

Shares = list[tuple[int, int]]

def generate(secret: int, num: int, threshold: int) -> Shares:
    def evaluate(coefficient: list[int], x: int) -> int:
        acc = 0
        power = 1
        for c in coefficient:
            acc = (acc + c * power) % P
            power *= x % P
        return acc

    coefficient = [secret] + [secrets.randbelow(P) for i in range(threshold - 1)]
    shares = []
    for i in range(num):
        x = i + 1
        shares.append((x, evaluate(coefficient, x)))
    return shares

def lagrange(share: Shares) -> int:
    """
    计算拉格朗日插值的常数项 a0
    """
    x = [i[0] for i in share]
    length = len(share)
    s = 0
    for i in range(length):
        pi = 1
        for j in range(length):
            if i == j:
                continue
            pi *= x[j] * modular_multiplicative_inverse(x[j] - x[i]) % P
        s = (s + share[i][1] * pi) % P
    return s

def modular_multiplicative_inverse(x: int, p: int = P) -> int:
    """
    division in integers modulus p means finding the inverse of the denominator
    modulo p and then multiplying the numerator by this inverse
    (Note: inverse of A is B such that A*B % p == 1)
    this can be computed via extended euclidean algorithm
    https://en.wikipedia.org/wiki/Modular_multiplicative_inverse#Computation
    """

    def extended_gcd(a: int, b: int) -> (int, int):
        x = 0
        last_x = 1
        y = 1
        last_y = 0
        while b != 0:
            quot = a // b
            a, b = b, a % b
            x, last_x = last_x - quot * x, x
            y, last_y = last_y - quot * y, y
        return last_x, last_y

    x, _ = extended_gcd(x, p)
    return x

```

另外，编写了包装函数完成 string 与 int 间的转换：

```python
MAX_LENGTH = 64

def encrypt(secret: str, num: int = 7, threshold: int = 0) -> Shares:
    if len(secret) > MAX_LENGTH:
        raise ValueError(f'length of secret should less than {MAX_LENGTH}')
    secret = int.from_bytes(secret.encode(), byteorder='little')
    if secret >= P:
        raise ValueError(f'secret should not bigger than P = {P}')
    if threshold == 0:
        threshold = num // 2 + 1
    elif threshold > num:
        raise ValueError('threshold is bigger than num, secret cannot be recovered')
    return generate(secret, num, threshold)


def decrypt(share: Shares) -> str:
    return lagrange(share).to_bytes(length=MAX_LENGTH, byteorder='little').decode().replace('\x00', '')

```




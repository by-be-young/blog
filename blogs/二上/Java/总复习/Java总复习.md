---
title: Java总复习
date: 2026-01-04
excerpt: Java题型总复习
recommended: false
type: 概要笔记
series: 二上总复习
---

# 访问控制与封装

## 访问修饰符

Java 提供了四种访问修饰符，控制类、变量、方法的可见性：

| 修饰符           | 同类  | 同包  | 子类（不同包） | 其他包 | 适用对象       |
| ------------- | --- | --- | ------- | --- | ---------- |
| **private**   | ✔   | ✘   | ✘       | ✘   | 变量、方法、内部类  |
| **默认**（包访问）   | ✔   | ✔   | ✘       | ✘   | 类、变量、方法    |
| **protected** | ✔   | ✔   | ✔       | ✘   | 变量、方法      |
| **public**    | ✔   | ✔   | ✔       | ✔   | 类、接口、变量、方法 |


[task]
[question]例题（2009）：设包 `com.co.project` 下有类 `Test`：
```java
package com.co.project;
public class Test{
    int i;          // 默认
    public int j;   // public
    protected int k;// protected
    private int l;  // private
}
```
下列说法正确的是：[\question]
[options]A 其它包中的所有类可以访问变量 i[\options]
[options]B 其它包中的所有类可以访问变量 j[\options]
[options]C 其它包中的所有类可以访问变量 k[\options]
[options]D 其它包中的所有类可以访问变量 l[\options]
[options]E 其它包中只有 Test 子类才能访问 l[\options]
[answer]B[\answer]
[analysis]
- `i`（默认）：仅同包可访问 ❌ a 错误
- `j`（public）：任何包可访问 ✅ b 正确
- `k`（protected）：同包或子类可访问，其他包非子类不能 ❌ c 错误
- `l`（private）：仅同类可访问 ❌ d 错误、❌ e 错误（子类也不能访问）
[\analysis]
[\task]

[task]
[question]例题（2025 模拟）：下列关于权限的说法中错误的是：[\question]
[options]A Java中一共有四种访问权限控制，其权限的大小顺序：public > protected > default > private[\options]
[options]B 普通方法可以使用四种访问权限，但是抽象方法不能使用 `private` 来修饰[\options]
[options]C 构造器可以使用四种访问权限[\options]
[options]D  `protected` 所修饰的成员，对于同包子类可访问，但是外包子类不可访问[\options]
[answer]D[\answer]
[analysis]
B 抽象方法如果被 `private` 修饰，则子类无法实现它，这与抽象方法的设计目的相悖。实际上，Java语言规范禁止抽象方法使用 `private`、`static`、`final` 等修饰符。
[\analysis]
[\task]

## 封装实践

[task]
[question]例题（2012）：给定类 `NumberHolder`，编写代码初始化成员并显示值。
```java
public class NumberHolder {
    public static final double PI; // 静态常量
    protected int anInt;           // 受保护实例变量
    private float aFloat;          // 私有实例变量
}
```
[\question]
[answer]
```java
public class NumberHolder {
    public static final double PI = 3.14159; // 常量必须初始化
    protected int anInt;
    private float aFloat;

    public NumberHolder(int anInt, float aFloat) {
        this.anInt = anInt;
        this.aFloat = aFloat;
    }
    public float getAFloat() { // 提供公共访问方法
        return aFloat;
    }
    public static void main(String[] args) {
        NumberHolder holder = new NumberHolder(10, 3.14f);
        System.out.println("PI: " + NumberHolder.PI);
        System.out.println("anInt: " + holder.anInt); // protected，同包或子类可直接访问
        System.out.println("aFloat: " + holder.getAFloat()); // private，需通过getter
    }
}
```
**输出：**
```
PI: 3.14159
anInt: 10
aFloat: 3.14
```
[\answer]
[\task]

# 构造方法

## 构造方法

① 必须与类名相同

② 无返回值与返回类型

③ 可重载

④ 不可被其他类显式调用

## new 的作用

① 分配内存：在堆内存里为对象分配空间

② 初始化对象：调用构造方法

③ 返回引用：返回对象的内存地址引用

# static 关键字

## 用法

包括静态变量、静态代码块、静态成员方法。

```java
class Restaurant {
    static String menu = "初始化菜单";  // 1.准备菜单（静态变量）
    
    static {
        System.out.println("办理营业执照");  // 2.办理执照（静态代码块）
    }
    
    String todaySpecial = "今日特价";  // 3.准备今日特价（非静态变量）
    
    {
        System.out.println("打扫卫生");  // 4.打扫店面（非静态代码块）
    }
    
    public Restaurant() {
        System.out.println("开门营业！");  // 5.正式开门（构造方法）
    }
}
```

## 执行顺序

### 第一次 new 时

#### 静态→非静态

初始化有显式初始化的静态成员变量→执行静态代码块→

初始化有显式初始化的非静态成员变量→执行非静态代码块→调用构造方法

### 第二次 new 时

#### 只执行非静态部分

即：初始化有显式初始化的非静态成员变量→执行非静态代码块→调用构造方法

# 内部类

| 类型    | 特点                                                   | 创建方式            | 代码写法                    |
| ----- | ---------------------------------------------------- | --------------- | ----------------------- |
| 实例内部类 | 外部类实例必须存在，能访问外部类所有成员                                 | 外部对象. new 内部类（） | class 里面有个 class        |
| 静态内部类 | 外部类实例不必存在，只能访问外部类的静态成员                               | new 外部类. 内部类（）  | class 里面有个 static class |
| 局部内部类 | 可访问外部类所有成员，及其中的 `final` 变量（非 final 或等效 final 变量不可访问） | 方法内直接 new       | 方法、代码块中有个 class         |


# 继承与多态

## 继承

① 子类拥有父类所有的属性和方法（私有除外）。

② 构造方法不能继承，子类构造必须先调用父类构造。

③ 子类隐藏父类同名变量。

隐藏规则：

```java
class Parent {
    int value = 10;        // 父类变量
    static int count = 1;  // 父类静态变量
}

class Child extends Parent {
    int value = 20;        // 隐藏父类同名实例变量
    static int count = 2;  // 隐藏父类同名静态变量
    
    void show() {
        System.out.println("子类value：" + value);          // 20
        System.out.println("父类value：" + super.value);    // 10
        System.out.println("子类count：" + Child.count);    // 2
        System.out.println("父类count：" + Parent.count);   // 1
    }
}
```

## 构造方法调用规则

- 子类构造方法默认调用父类无参构造 `super()`
- 若父类没有无参构造，子类必须显式调用 `super(...)`
- `super()` 或 `this()` 必须位于构造方法第一行

[task]
[question]例题（2009）：下列正确的是：[\question]
[options]A 子类必须通过 super 关键字才能调用父类有参数构造的方法[\options]
[options]B 子类必须通过 this 关键字才能调用父类有参数构造的方法[\options]
[options]C 子类无条件继承父类不含参数的构造方法[\options]
[options]D 如果子类定义自己含参数的构造方法，就不能再调用父类的构造函数[\options]
[answer]A[\answer]
[analysis]
- a) 若需调用父类**有参构造**，必须使用 `super(...)` ✅
- b) `this` 用于调用本类构造 ❌
- c) 构造方法**不被继承** ❌
- d) 子类定义有参构造后，仍可用 `super()` 调用父类无参构造（若存在）❌
[\analysis]
[\task]

## 方法重写（Override）与方法重载（Overload）

### 主要区别

| 维度              | **方法重写 (Override)** | **方法重载 (Overload)** |
| --------------- | ------------------- | ------------------- |
| **定义**          | 子类重新实现父类的方法         | 同一个类中多个同名方法         |
| **位置**          | 不同类（父子类）            | 同一个类                |
| **方法名与参数列表**    | 必须完全相同              | 必须不同（参数类型/个数/顺序）    |
| **返回类型**        | **相同或协变返回类型**       | 可以不同                |
| **访问权限**        | **不能比父类更严格**        | 可以不同                |
| **异常**          | **不能抛出更宽泛的检查异常**    | 可以不同                |
| **`@Override`** | 建议使用                | 不能使用                |
| **多态类型**        | **运行时多态**           | **编译时多态**           |
| **绑定时机**        | 运行时动态绑定             | 编译时静态绑定             |
| **目的**          | 修改/扩展父类行为           | 增加方法灵活性             |

### 方法的可重写/可重载性

| 方法类型          | 能否被重写       | 能否被重载     |
| ------------- | ----------- | --------- |
| **静态方法**      | ❌ 不能（只能隐藏）  | ✅ 可以      |
| **private方法** | ❌ 不能（子类不可见） | ✅ 可以（同类中） |
| **构造方法**      | ❌ 不能（不继承）   | ✅ 可以      |
| **final方法**   | ❌ 不能        | ✅ 可以      |
| **普通实例方法**    | ✅ 可以        | ✅ 可以      |

[task]
[question]例题（2012）：以下哪个陈述是正确的？[\question]
[options]A 方法不能被重写为更私有[\options]
[options]B 静态方法不能被重载[\options]
[options]C 私有方法不能被重载[\options]
[options]D 重载方法不能抛出基类中未检查的异常[\options]
[answer]A[\answer]
[analysis]
A ✅ 重写方法不能降低访问权限（如 public -> private）

B ❌ 静态方法可以重载（参数不同），不能被重写。

C ❌ 私有方法可以重载（同类中），不能被重写。

D ❌ 重载（Overload）是编译时多态，与异常无关；重写方法可以抛出非检查异常，也可以抛出不比父类更宽泛的检查异常
[\analysis]
[\task]

## 多态与类型转换

| 维度 | 编译时多态（静态多态） | 运行时多态（动态多态） |
|------|----------------------|----------------------|
| **实现方式** | 方法重载（Overload） | 方法重写（Override） + 继承 |
| **绑定时机** | 编译时确定 | 运行时确定 |
| **判断依据** | 方法签名（参数列表） | 对象实际类型 |
| **技术名称** | 静态绑定（早绑定） | 动态绑定（晚绑定） |
| **核心机制** | 编译时根据引用类型和方法参数决定调用 | 运行时根据对象实际类型决定调用 |
| **表现形式** | 同一个类中多个同名不同参数的方法 | 父类引用指向子类对象，调用被子类重写的方法 |
| **向上转型** | 不需要 | 必须（`Parent p = new Child()`） |
| **向下转型** | 不需要 | 可能需要（`Child c = (Child)p`） |
| **典型代码** | `void f(int)` 和 `void f(String)` | `Animal a = new Dog(); a.sound();` |
| **多态体现** | 同一个方法名处理不同类型参数 | 同一个方法调用产生不同行为 |
| **性能** | 编译时解析，性能好 | 运行时查找，稍慢 |
| **灵活性** | 较低 | 高，支持扩展 |
| **设计模式** | 较少直接关联 | 模板方法、策略模式等基础 |

### 补充说明

**向上转型**：自动进行，子类转父类（`Parent p = new Child()`）

**向下转型**：需要强制转换，有风险（`Child c = (Child)p`，可能 ClassCastException）。具体会不会异常需要看 p 的实际类型是不是 Child 或其子类。

**instanceof**：用于安全的向下转型检查

**多态三要素**：继承、重写、父类引用指向子类对象

## 成员访问规则

| 访问内容     | 编译时（检查阶段）               | 运行时（执行阶段）                | 是否有多态  |
| -------- | ----------------------- | ------------------------ | ------ |
| **实例变量** | 看引用类型（左边）               | 看引用类型（左边）                | ❌ 没有多态 |
| **静态变量** | 看引用类型（左边）               | 看引用类型（左边）                | ❌ 没有多态 |
| **实例方法** | 看引用类型（左边）<br>（检查方法是否存在） | 看实际对象类型（右边）<br>（执行重写的方法） | ✅ 有多态  |
| **静态方法** | 看引用类型（左边）               | 看引用类型（左边）                | ❌ 没有多态 |

## 代码执行判断流程表

情景：`Parent obj = new Child();`

| 操作                   | 判断流程                                                                            | 结果来源                                     |
| -------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| `obj.field`          | 1. 编译：Parent 类有 field 吗？→ 有 ✓<br>2. 运行：直接取 Parent 类的 field                      | Parent 类的 field                          |
| `obj.staticField`    | 1. 编译：Parent 类有 staticField 吗？→ 有 ✓<br>2. 运行：直接取 Parent 类的 staticField          | Parent 类的 staticField                    |
| `obj.method()`       | 1. 编译：Parent 类有 method () 吗？→ 有 ✓<br>2. 运行：查找 Child 类重写的 method () 执行           | Child 类重写的方法，若未重写则执行 Parent 类的 method () |
| `obj.staticMethod()` | 1. 编译：Parent 类有 staticMethod () 吗？→ 有 ✓<br>2. 运行：直接调用 Parent 类的 staticMethod () | Parent 类的 staticMethod                   |
| `obj.子类特有方法()`       | 1. 编译：Parent 类有这个方法吗？→ ❌ 没有<br>2. 运行：不执行（编译已报错）                                 | 编译错误                                     |

[task]
[question]例题（2012）：编译运行以下代码的结果是？
```java
class Base {}
class Sub extends Base {}
class Sub2 extends Base {}
public class Test{
    public static void main(String args[]) {
        Base b = new Base();
        Sub s = (Sub) b; // 向下转型
        System.out.println("everything is fine");
    }
}
```
[\question]
[options]A 编译并运行无误[\options]
[options]B 编译时异常[\options]
[options]C 运行时异常[\options]
[options]D 将打印出 "everything is fine"[\options]
[answer]C[\answer]
[analysis]
对象 `b` 是 `Base` 实例，不是 `Sub` 实例。强制向下转型 `(Sub) b` 会在运行时抛出 `ClassCastException`。
[\analysis]
[\task]

# 异常处理

## 异常类层次与关键字

- **`Throwable`**：所有错误（Error）和异常（Exception）的父类
- **`throw`**：用于抛出一个异常对象
- **`throws`**：用于方法声明，表示可能抛出的异常类型
- **`try-catch-finally`**：捕获和处理异常

[task]
[question]例题（2009）：所有异常的基础类是：[\question]
[options]A String[\options]
[options]B error[\options]
[options]C Throwable[\options]
[options]D RuntimeException[\options]
[answer]C[\answer]
[analysis]
`Throwable` 是 `Error` 和 `Exception` 的父类。✅ c 正确。
[\analysis]
[\task]

[task]
[question]例题（2016）：在 Java 语言中，以下哪个关键字用于在方法上声明抛出异常？[\question]
[options]A try[\options]
[options]B catch[\options]
[options]C throws[\options]
[options]D throw[\options]
[answer]C[\answer]
[analysis]
`throws` 用于方法签名声明异常，`throw` 用于抛出异常实例。✅ C 正确。
[\analysis]
[\task]

## finally 执行顺序

`finally` 块总会在 `try` 或 `catch` 块**返回前**执行。

[task]
[question]例题（2012）：以下代码的输出是？
```java
public class Test1 {
    public static void main(String argv[]) {
        Test1 m = new Test1();
        System.out.println(m.aMethod());
    }
    public int aMethod() {
        try {
            throw new Exception();
        } catch (Exception ex) {
            System.out.println("No such file found");
            return -1;
        } finally {
            System.out.println("Doing finally");
        }
    }
}
```
[\question]
[answer]
1.  抛出并捕获异常，打印 "No such file found"
2.  执行 `finally` 块，打印 "Doing finally"
3.  返回 `-1`，被 `main` 方法打印
**输出：**
```
No such file found
Doing finally
-1
```
[\answer]
[\task]

# 常用类与集合

## String 类

### 特点

① 不可变性：被声明为 final 类，因此String 对象一旦创建，其内容不可更改。

② 字符串池：字面量创建的字符串会放入常量池，重复使用。

#### ③  `==` 与 `equals`：`==` 比较引用地址，即是否是同一对象； `equals` 比较内容。

### 常用方法

concat（）：连接字符串

substring（）：截取字符串

replace（）：替换字符/字符串

#### 注意，这些方法都返回一个新的字符串，因为 String 类的对象不可更改。

[task]
[question]例题（2016）：以下代码的输出是？
```java
public class Test1 {
    public static void main(String[] args) {
        String s1 = new String("abc");
        String s2 = s1;
        String s3 = "abc";
        System.out.println(s1 == s2);
        System.out.println(s2 == s3);
        System.out.println(s1 == s3);
        System.out.println(s1.equals(s2));
        System.out.println(s1.equals(s3));
        System.out.println(s2.equals(s3));
    }
}
```
[\question]
[answer]
- `s1 == s2`：`true`（引用相同对象）
- `s2 == s3`：`false`（`s1` / `s2` 在堆，`s3` 可能在常量池）
- `s1 == s3`：`false`（同上）
- 所有 `equals` 比较：`true`（内容相同）
**输出：**
```
true
false
false
true
true
true
```
[\answer]
[\task]

## 集合框架

### 三大类

| 三大类  | 特点       |
| ---- | -------- |
| Set  | 无序，元素不重复 |
| List | 有序，元素可重复 |
| Map  | 键值对存储    |

### 常见实现类

| 常见实现类      | 特点              |
| ---------- | --------------- |
| ArrayList  | 查询快，增删慢         |
| LinkedList | 增删快，查询慢         |
| HashSet    | 实现 Set 接口，无序、唯一 |
| HashMap    | 实现 Map 接口       |


[task]
[question]例题（2016）：下列关于集合类描述错误的是？[\question]
[options]A ArrayList 和 LinkedList 均实现了 List 接口[\options]
[options]B ArrayList 的访问速度比 LinkedList 快[\options]
[options]C 添加和删除元素时，ArrayList 的表现更佳[\options]
[options]D HashMap 实现 Map 接口，允许 null 键值[\options]
[answer]C[\answer]
[analysis]
- A ✅
- B ✅ ArrayList 基于数组，随机访问快
- C ❌ LinkedList 在添加/删除（尤其中间位置）时表现更佳
- D ✅
**结论：** C 错误。
[\analysis]
[\task]

[task]
[question]例题（2025 模拟）：关于Java类LinkedList的特点，下面描述正确的是：[\question]
[options]A 查询快[\options]
[options]B 增加快[\options]
[options]C 元素不重复[\options]
[options]D 元素自然排序[\options]
[answer]B[\answer]
[analysis]
A、错误，基于双向链表，查询慢。
B、正确，增删快
C、错误，List 中可重复
D、错误，保持插入顺序
[\analysis]
[\task]

## 抽象类与接口

| 对比维度       | 抽象类 (Abstract Class)               | 接口 (Interface)                      |
| ---------- | ---------------------------------- | ----------------------------------- |
| **关键字**    | `abstract class`                   | `interface`                         |
| **继承关系**   | 单继承 (`extends`)                    | 多实现 (`implements`)，接口多继承            |
| **构造方法**   | ✅ 可以有                              | ❌ 不能有                               |
| **实例化**    | ❌ 不能实例化                            | ❌ 不能实例化                             |
| **抽象方法**   | `abstract` 修饰，必须在子类中实现（除非子类也是抽象类）  | 方法默认 `public abstract`，必须实现         |
| **具体方法**   | ✅ 可以有（有方法体）                        | 支持 `default` 默认方法                   |
| **变量**     | 可以有普通变量                            | 变量默认 `public static final`（常量）      |
| **方法修饰限制** | 抽象方法不能为：`private`、`final`、`static` | 方法默认 `public abstract`，支持 `private` |
| **设计目的**   | 代码复用 + 规范约束（"是什么"关系）               | 行为契约定义（"能做什么"关系）                    |
| **回调机制**   | ❌ 不支持                              | ✅ 支持（接口回调）                          |
| **强制实现**   | 子类必须实现所有抽象方法（除非子类也是抽象类）            | 实现类必须实现所有抽象方法（除非用 `default`）        |

# 单例模式

| 维度 | 饿汉式 (Eager) | 懒汉式 (Lazy) |
|------|---------------|--------------|
| **初始化时机** | 类加载时立即初始化 | 第一次调用 `getInstance()` 时初始化 |
| **线程安全** | ✅ 天生线程安全 | ❌ 基础版线程不安全（需加锁） |
| **性能** | 访问速度快（已初始化） | 首次访问稍慢（需初始化） |
| **内存使用** | 可能浪费内存（即使不用也创建） | 节省内存（用时才创建） |
| **实现复杂度** | 简单 | 较复杂（需考虑线程安全） |
| **常见实现** | 静态常量、静态代码块 | 双重检查锁、静态内部类 |
| **序列化安全** | ❌ 默认不安全 | ❌ 默认不安全（都需实现 `readResolve()`） |
| **反射攻击** | 脆弱 | 脆弱（都需防反射） |
| **推荐场景** | 对象小、必用、初始化快 | 对象大、可能不用、初始化慢 |

# 多线程

## 线程创建与启动

- 继承 `Thread` 类，重写 `run()` 方法
- 实现 `Runnable` 接口，实现 `run()` 方法
- **启动线程必须调用 `start()` 方法**，而不是直接调用 `run()`

[task]
[question]例题（2009）：哪个方法是启动新线程的方法？[\question]
[options]A 只需创建[\options]
[options]B 创建并调用 start ()[\options]
[options]C 创建并调用 begin ()[\options]
[options]D 创建并调用 startThread ()[\options]
[answer]B[\answer]
[analysis]
✅ b 正确。`start()` 方法会启动新线程并自动调用 `run()`。
[\analysis]
[\task]

## 线程状态与 sleep ()

- `sleep(long millis)`：使当前线程休眠指定毫秒，进入**TIMED_WAITING**状态，**不释放锁**。

[task]
[question]例题（2016）：线程调用 sleep () 方法后，该线程将进入以下哪种状态？[\question]
[options]A 跳转状态[\options]
[options]B 运行状态[\options]
[options]C 阻塞状态[\options]
[options]D 死亡状态[\options]
[answer]C[\answer]
[analysis]
✅ C 正确。`sleep()` 使线程进入**阻塞（Blocked）** 或**限时等待（Timed Waiting）** 状态。
[\analysis]
[\task]

# 输入输出（I/O）

## 字节流与字符流

- **字节流**：`InputStream`, `OutputStream`（处理一切二进制数据）
- **字符流**：`Reader`, `Writer`（处理文本，考虑编码）

[task]
[question]例题（2009）：下面哪个语句能正确地创建一个 InputStreamReader 的实例？[\question]
[options]A new InputStreamReader (new FileInputStream ("data. Txt"));[\options]
[options]B new InputStreamReader (new FileReader ("data. Txt"));[\options]
[options]C new InputStreamReader (new BufferReader ("data. Txt"));[\options]
[options]D new InputStreamReader ("data. Txt");[\options]
[answer]A[\answer]
[analysis]
`InputStreamReader` 是字节流通向字符流的桥梁，它**接收一个 `InputStream`**。
- a ✅ 正确。`FileInputStream` 是 `InputStream`
- b ❌ `FileReader` 已经是 `Reader`
- c ❌ 参数错误
- d ❌ 参数错误
**结论：** a 正确。
[\analysis]
[\task]

# 垃圾回收（GC）

## GC 基本特点

**自动管理**：由 JVM 自动执行，程序员无法控制精确时机。

**回收目标**：回收不再被引用的对象所占用的内存。

**不确定性**：无法保证在期望时间内释放内存。

[task]
[question]例题（2009/2010/2012/2016 多次出现）：关于 Java 垃圾收集，下列哪个是正确的？[\question]
[options]A 垃圾收集机制将检查并回收不再使用的内存[\options]
[options]B 垃圾收集机制允许开发者明确制定并释放该内存[\options]
[options]C 程序开发者必须自己创建一个线程运行内存释放工作[\options]
[options]D 垃圾收集机制能在期望时间内释放被 Java 对象使用的内存[\options]
[answer]A[\answer]
[analysis]
- a ✅ 正确，描述了 GC 的基本作用。
- b ❌ 开发者不能显式、立即地释放内存（`System.gc()` 只是建议）。
- c ❌ GC 由 JVM 自动管理。
- d ❌ GC 时间不确定。
**结论：** a 正确。
[\analysis]
[\task]

# 综合与易错点

## 静态上下文限制

静态方法（`static`）中不能直接使用 `this` 或 `super`，也不能直接访问非静态成员。

[task]
[question]例题（2016）：以下程序的运行结果是？
```java
class Person{
    String name="Chinese";
    public Person(){ System.out.println("This is a person"); }
}
public class SchoolMaster extends Person{
    String ID;
    public SchoolMaster(){
        super();
        System.out.println("This is a SchoolMaster");
    }
    public static void main(String[] args) {
        SchoolMaster tea=new SchoolMaster();
        System.out.println(super.name); // 错误行
    }
}
```
[\question]
[options]A 编译运行正常输出[\options]
[options]B 编译有语法错误[\options]
[options]C 运行出错[\options]
[options]D 以上都不对[\options]
[answer]B[\answer]
[analysis]
`main` 是静态方法，其中不能使用 `super` 关键字。✅ B 正确（编译错误）。
[\analysis]
[\task]

## 接口与抽象类

| 特性 | 抽象类 (abstract class) | 接口 (interface) |
| :--- | :--- | :--- |
| **构造方法** | 有 | 无 |
| **多继承** | 不支持（单继承） | 支持（多继承接口） |
| **方法实现** | 可以有具体方法 | Java 8 前完全抽象，8 后可有 default/static 方法 |
| **成员变量** | 无限制 | 默认 `public static final` |

[task]
[question]例题（2016）：以下对接口描述错误的是？[\question]
[options]A 接口没有提供构造方法[\options]
[options]B 接口中的方法默认使用 public、abstract 修饰[\options]
[options]C 接口中的属性默认使用 public、static、final 修饰[\options]
[options]D 接口不允许多继承[\options]
[answer]D[\answer]
[analysis]
接口可以继承多个接口（`interface A extends B, C`）。❌ D 错误。
[\analysis]
[\task]

## 数组与初始化

- 数组是对象，声明时未分配空间。
- 基本类型数组元素有默认值（如 int 为 0）。
- 引用类型数组元素默认值为 `null`。

[task]
[question]例题（2012）：编译并运行以下代码时会发生什么？
```java
public class Q {
    public static void main(String argv[]){
        int anArray[] = new int[5];
        System.out.println(anArray[0]);
    }
}
```
[\question]
[options]A 错误：anArray 在初始化之前被引用[\options]
[options]B null[\options]
[options]C 0[\options]
[options]D 5[\options]
[answer]C[\answer]
[analysis]
数组已创建，`int` 数组元素默认值为 0。✅ C 正确。
[\analysis]
[\task]
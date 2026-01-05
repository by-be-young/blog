---
id: 1997227528
title: Java总复习（待完善）
date: 2026-01-04
tags:
  - 学习
  - Java
  - 总复习
excerpt: Java题型总复习
recommended: true
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


> **例题（2009）：** 设包 `com.co.project` 下有类 `Test`：
> ```java
> package com.co.project;
> public class Test{
>     int i;          // 默认
>     public int j;   // public
>     protected int k;// protected
>     private int l;  // private
> }
> ```
> 下列说法正确的是：
> 
> A) 其它包中的所有类可以访问变量 i；  
> B) 其它包中的所有类可以访问变量 j；  
> C) 其它包中的所有类可以访问变量 k；  
> D) 其它包中的所有类可以访问变量 l；  
> E) 其它包中只有 Test 子类才能访问 l；
>
> **解：**
> - `i`（默认）：仅同包可访问 ❌ a 错误
> - `j`（public）：任何包可访问 ✅ b 正确
> - `k`（protected）：同包或子类可访问，其他包非子类不能 ❌ c 错误
> - `l`（private）：仅同类可访问 ❌ d 错误、❌ e 错误（子类也不能访问）

## 封装实践

> **例题（2012）：** 给定类 `NumberHolder`，编写代码初始化成员并显示值。
> ```java
> public class NumberHolder {
>     public static final double PI; // 静态常量
>     protected int anInt;           // 受保护实例变量
>     private float aFloat;          // 私有实例变量
> }
> ```
>
> **解：**
> ```java
> public class NumberHolder {
>     public static final double PI = 3.14159; // 常量必须初始化
>     protected int anInt;
>     private float aFloat;
>
>     public NumberHolder(int anInt, float aFloat) {
>         this.anInt = anInt;
>         this.aFloat = aFloat;
>     }
>     public float getAFloat() { // 提供公共访问方法
>         return aFloat;
>     }
>     public static void main(String[] args) {
>         NumberHolder holder = new NumberHolder(10, 3.14f);
>         System.out.println("PI: " + NumberHolder.PI);
>         System.out.println("anInt: " + holder.anInt); // protected，同包或子类可直接访问
>         System.out.println("aFloat: " + holder.getAFloat()); // private，需通过getter
>     }
> }
> ```
> **输出：**
> ```
> PI: 3.14159
> anInt: 10
> aFloat: 3.14
> ```

# 继承与多态

## 构造方法调用规则

- 子类构造方法默认调用父类无参构造 `super()`
- 若父类没有无参构造，子类必须显式调用 `super(...)`
- `super()` 或 `this()` 必须位于构造方法第一行

> **例题（2009）：** 下列正确的是：
> 
> A) 子类必须通过 super 关键字才能调用父类有参数构造的方法；  
> B) 子类必须通过 this 关键字才能调用父类有参数构造的方法；  
> C) 子类无条件继承父类不含参数的构造方法；  
> D) 如果子类定义自己含参数的构造方法，就不能再调用父类的构造函数；
>
> **解：**
> - a) 若需调用父类**有参构造**，必须使用 `super(...)` ✅ 
> - b) `this` 用于调用本类构造 ❌
> - c) 构造方法**不被继承** ❌
> - d) 子类定义有参构造后，仍可用 `super()` 调用父类无参构造（若存在）❌
>
> **结论：** a 正确。

## 方法重写（Override）规则

1.  方法名、参数列表必须相同
2.  返回类型相同或是其子类（协变返回类型）
3.  访问权限不能更严格（不能缩小）
4.  不能抛出比父类方法**更宽泛**的检查异常

> **例题（2012）：** 以下哪个陈述是正确的？
> 
> A. 方法不能被重写为更私有  
> B. 静态方法不能被重载  
> C. 私有方法不能被重载  
> D. 重载方法不能抛出基类中未检查的异常
>
> **解：**
> - A ✅ 重写方法不能降低访问权限（如 public -> private）
> - B ❌ 静态方法可以重载（参数不同）
> - C ❌ 私有方法可以重载（同类中）
> - D ❌ 重载（Overload）是编译时多态，与异常无关
>
> **结论：** A 正确。

## 多态与类型转换

> **例题（2012）：** 编译运行以下代码的结果是？
> ```java
> class Base {}
> class Sub extends Base {}
> class Sub2 extends Base {}
> public class Test{
>     public static void main(String args[]) {
>         Base b = new Base();
>         Sub s = (Sub) b; // 向下转型
>         System.out.println("everything is fine");
>     }
> }
> ```
> A. 编译并运行无误  
> B. 编译时异常  
> C. 运行时异常  
> D. 将打印出 "everything is fine"
>
> **解：**
> 对象 `b` 是 `Base` 实例，不是 `Sub` 实例。强制向下转型 `(Sub) b` 会在运行时抛出 `ClassCastException`。
> **结论：** C 正确。

# 异常处理

## 异常类层次与关键字

- **`Throwable`**：所有错误（Error）和异常（Exception）的父类
- **`throw`**：用于抛出一个异常对象
- **`throws`**：用于方法声明，表示可能抛出的异常类型
- **`try-catch-finally`**：捕获和处理异常

> **例题（2009）：** 所有异常的基础类是：
> 
> A) String 
> 
> b) error 
> 
> c) Throwable 
> 
> d) RuntimeException
>
> **解：** `Throwable` 是 `Error` 和 `Exception` 的父类。✅ c 正确。

> **例题（2016）：** 在 Java 语言中，以下哪个关键字用于在方法上声明抛出异常？
> 
> A. try  
> 
> B. catch  
> 
> C. throws  
> 
> D. throw
>
> **解：** `throws` 用于方法签名声明异常，`throw` 用于抛出异常实例。✅ C 正确。

## Finally 执行顺序

`finally` 块总会在 `try` 或 `catch` 块**返回前**执行。

> **例题（2012）：** 以下代码的输出是？
> ```java
> public class Test1 {
>     public static void main(String argv[]) {
>         Test1 m = new Test1();
>         System.out.println(m.aMethod());
>     }
>     public int aMethod() {
>         try {
>             throw new Exception();
>         } catch (Exception ex) {
>             System.out.println("No such file found");
>             return -1;
>         } finally {
>             System.out.println("Doing finally");
>         }
>     }
> }
> ```
>
> **解：**
> 1.  抛出并捕获异常，打印 "No such file found"
> 2.  执行 `finally` 块，打印 "Doing finally"
> 3.  返回 `-1`，被 `main` 方法打印
> **输出：**
> ```
> No such file found
> Doing finally
> -1
> ```

# 常用类与集合

## String 类

- **不可变性**：String 对象一旦创建，其内容不可更改。
- **字符串池**：字面量创建的字符串会放入常量池，重复使用。
- **`==` 与 `equals`**：`==` 比较引用地址，`equals` 比较内容。

> **例题（2016）：** 以下代码的输出是？
> ```java
> public class Test1 {
>     public static void main(String[] args) {
>         String s1 = new String("abc");
>         String s2 = s1;
>         String s3 = "abc";
>         System.out.println(s1 == s2);
>         System.out.println(s2 == s3);
>         System.out.println(s1 == s3);
>         System.out.println(s1.equals(s2));
>         System.out.println(s1.equals(s3));
>         System.out.println(s2.equals(s3));
>     }
> }
> ```
>
> **解：**
> - `s1 == s2`：`true`（引用相同对象）
> - `s2 == s3`：`false`（`s1` / `s2` 在堆，`s3` 可能在常量池）
> - `s1 == s3`：`false`（同上）
> - 所有 `equals` 比较：`true`（内容相同）
> **输出：**
> ```
> true
> false
> false
> true
> true
> true
> ```

## 集合框架

- **List**：有序、可重复（ArrayList, LinkedList）
- **Set**：无序、不可重复（HashSet, TreeSet）
- **Map**：键值对（HashMap, TreeMap）

> **例题（2016）：** 下列关于集合类描述错误的是？
> 
> A) ArrayList 和 LinkedList 均实现了 List 接口  
> B) ArrayList 的访问速度比 LinkedList 快  
> C) 添加和删除元素时，ArrayList 的表现更佳  
> D) HashMap 实现 Map 接口，允许 null 键值
>
> **解：**
> - A ✅
> - B ✅ ArrayList 基于数组，随机访问快
> - C ❌ LinkedList 在添加/删除（尤其中间位置）时表现更佳
> - D ✅
> **结论：** C 错误。

# 多线程

## 线程创建与启动

- 继承 `Thread` 类，重写 `run()` 方法
- 实现 `Runnable` 接口，实现 `run()` 方法
- **启动线程必须调用 `start()` 方法**，而不是直接调用 `run()`

> **例题（2009）：** 哪个方法是启动新线程的方法？
> 
> A) 只需创建  
> B) 创建并调用 start ()  
> C) 创建并调用 begin ()  
> D) 创建并调用 startThread ()
>
> **解：** ✅ b 正确。`start()` 方法会启动新线程并自动调用 `run()`。

## 线程状态与 sleep ()

- `sleep(long millis)`：使当前线程休眠指定毫秒，进入**TIMED_WAITING**状态，**不释放锁**。

> **例题（2016）：** 线程调用 sleep () 方法后，该线程将进入以下哪种状态？
> 
> A. 跳转状态  
> B. 运行状态  
> C. 阻塞状态  
> D. 死亡状态
>
> **解：** ✅ C 正确。`sleep()` 使线程进入**阻塞（Blocked）** 或**限时等待（Timed Waiting）** 状态。

# 输入输出（I/O）

## 字节流与字符流

- **字节流**：`InputStream`, `OutputStream`（处理一切二进制数据）
- **字符流**：`Reader`, `Writer`（处理文本，考虑编码）

> **例题（2009）：** 下面哪个语句能正确地创建一个 InputStreamReader 的实例？
> 
> A) new InputStreamReader (new FileInputStream ("data. Txt"));  
> B) new InputStreamReader (new FileReader ("data. Txt"));  
> C) new InputStreamReader (new BufferReader ("data. Txt"));  
> D) new InputStreamReader ("data. Txt");
>
> **解：**
> `InputStreamReader` 是字节流通向字符流的桥梁，它**接收一个 `InputStream`**。
> - a ✅ 正确。`FileInputStream` 是 `InputStream`
> - b ❌ `FileReader` 已经是 `Reader`
> - c ❌ 参数错误
> - d ❌ 参数错误
> **结论：** a 正确。

# 垃圾回收（GC）

## GC 基本特点

- **自动管理**：由 JVM 自动执行，程序员无法控制精确时机。
- **回收目标**：回收不再被引用的对象所占用的内存。
- **不确定性**：无法保证在期望时间内释放内存。

> **例题（2009/2010/2012/2016 多次出现）：** 关于 Java 垃圾收集，下列哪个是正确的？
> 
> A) 垃圾收集机制将检查并回收不再使用的内存；  
> B) 垃圾收集机制允许开发者明确制定并释放该内存；  
> C) 程序开发者必须自己创建一个线程运行内存释放工作；  
> D) 垃圾收集机制能在期望时间内释放被 Java 对象使用的内存。
>
> **解：**
> - a ✅ 正确，描述了 GC 的基本作用。
> - b ❌ 开发者不能显式、立即地释放内存（`System.gc()` 只是建议）。
> - c ❌ GC 由 JVM 自动管理。
> - d ❌ GC 时间不确定。
> **结论：** a 正确。

# 综合与易错点

## 静态上下文限制

静态方法（`static`）中不能直接使用 `this` 或 `super`，也不能直接访问非静态成员。

> **例题（2016）：** 以下程序的运行结果是？
> ```java
> class Person{
>     String name="Chinese";
>     public Person(){ System.out.println("This is a person"); }
> }
> public class SchoolMaster extends Person{
>     String ID;
>     public SchoolMaster(){
>         super();
>         System.out.println("This is a SchoolMaster");
>     }
>     public static void main(String[] args) {
>         SchoolMaster tea=new SchoolMaster();
>         System.out.println(super.name); // 错误行
>     }
> }
> ```
> A) 编译运行正常输出  
> B) 编译有语法错误  
> C) 运行出错  
> D) 以上都不对
>
> **解：** `main` 是静态方法，其中不能使用 `super` 关键字。✅ B 正确（编译错误）。

## 接口与抽象类

| 特性 | 抽象类 (abstract class) | 接口 (interface) |
| :--- | :--- | :--- |
| **构造方法** | 有 | 无 |
| **多继承** | 不支持（单继承） | 支持（多继承接口） |
| **方法实现** | 可以有具体方法 | Java 8 前完全抽象，8 后可有 default/static 方法 |
| **成员变量** | 无限制 | 默认 `public static final` |

> **例题（2016）：** 以下对接口描述错误的是？
> 
> A) 接口没有提供构造方法  
> B) 接口中的方法默认使用 public、abstract 修饰  
> C) 接口中的属性默认使用 public、static、final 修饰  
> D) 接口不允许多继承
>
> **解：** 接口可以继承多个接口（`interface A extends B, C`）。❌ D 错误。

## 数组与初始化

- 数组是对象，声明时未分配空间。
- 基本类型数组元素有默认值（如 int 为 0）。
- 引用类型数组元素默认值为 `null`。

> **例题（2012）：** 编译并运行以下代码时会发生什么？
> 
> ```java
> public class Q {
>     public static void main(String argv[]){
>         int anArray[] = new int[5];
>         System.out.println(anArray[0]);
>     }
> }
> ```
> A. 错误：anArray 在初始化之前被引用  
> B. null  
> C. 0  
> D. 5
>
> **解：** 数组已创建，`int` 数组元素默认值为 0。✅ C 正确。

---
**总结提示**：Java 考试常考**封装继承多态、异常处理、字符串比较、集合特点、多线程基础、GC 机制、静态与非静态区别**。复习时务必理解概念，并通过代码验证。
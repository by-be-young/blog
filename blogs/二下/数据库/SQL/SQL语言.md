---
type: 概要笔记
series: 数据库
order: "5"
chapter: 1-知识点
excerpt: 数据库SQL语言语法速成
---
# DDL 语言（数据定义语言）

## 定义基本表

### CREATE TABLE 语法

```
CREATE TABLE <表名> (
    <列名> <数据类型> [<列级完整性约束>],
    [<列名> <数据类型> [<列级完整性约束>]],
    ...
    [<表级完整性约束>]
);
```

### 常见数据类型

- INT / INTEGER：整型
    
- REAL / FLOAT：浮点型
    
- CHAR (n)：定长字符串
    
- VARCHAR (n)：变长字符串，n 为最大长度
    
- DATE、TIME、DATETIME：日期时间类型
    

### 列级完整性约束

- PRIMARY KEY：主键约束（当只有一个主键时才可以）
    
- UNIQUE：唯一性约束
    
- NOT NULL：非空值约束

- CHECK(条件)：检查该列是否满足某个条件

### 表级完整性约束

- PRIMARY KEY：主键约束
    
- FOREIGN KEY(列名) REFERENCES 被参照表（列名）：参照完整性约束（外键）

### 示例

```
CREATE TABLE Student (
    Sno CHAR(5) NOT NULL UNIQUE,
    Sname CHAR(20) UNIQUE,
    Ssex CHAR(1),
    Sage INT,
    Sdept VARCHAR(15)
);

CREATE TABLE SC (
    Sno CHAR(5),
    Cno CHAR(3),
    Grade INT,
    Primary Key (Sno, Cno)
);
```

## 删除基本表

```
DROP TABLE <表名>;
```

## 修改基本表

```
ALTER TABLE <表名>
    [ADD <新列名> <数据类型> [完整性约束]]
    [DROP <完整性约束名>]
    [MODIFY <列名> <数据类型>];
```

- ADD 子句：增加新列和新约束，新增加的列一律为空值
    
- DROP 子句：删除指定列或约束
    
- MODIFY 子句：修改列名和数据类型，可能破坏已有数据
    

# 查询语言（SELECT）

## 查询语句基本结构

```
SELECT 列名
FROM 表/视图名
WHERE 行过滤条件
GROUP BY 列名	HAVING 分组条件
ORDER BY 排序（ASC 升序/DESC 降序）;
```

## 单表查询

### 选择列与计算列

- 选择全部列：`SELECT * FROM Student`
    
- 选择部分列：`SELECT Sno, Sname FROM Student`
    
- 使用表达式：`SELECT Sname, 2026-Sage FROM Student`（计算出生年份）
    
- 使用列别名：`SELECT Sname AS NAME, Sage AS AGE FROM Student`
    
- 消除重复行：`SELECT DISTINCT Sno FROM SC`
    

### WHERE 条件查询

|查询条件|谓词|
|---|---|
|比较|=, >, <, >=, <=, !=, <>|
|确定范围|BETWEEN ... AND ..., NOT BETWEEN ... AND ...|
|确定集合|IN (...), NOT IN (...)|
|字符串匹配|LIKE, NOT LIKE（%任意长度，_单个字符）|
|空值判断|IS NULL, IS NOT NULL|
|多重条件|AND, OR, NOT|

- 转义通配符：使用 ESCAPE，如 `LIKE 'DB\_%' ESCAPE '\'`
    
- 空值比较：任何值与 NULL 比较结果为 UNKNOWN，不能用 `= NULL`，必须用 `IS NULL`
    

### 排序

- `ORDER BY 列名 [ASC|DESC]`，可多列排序
    
- 空值排序：ASC 时空值最后，DESC 时空值最前
    

### 聚集函数

- COUNT ( * )：统计元组数
    
- COUNT (列名)：统计非空值个数
    
- SUM、AVG、MAX、MIN
    
- DISTINCT 选项：取消重复值后再计算，如 `COUNT(DISTINCT Sno)`
    
- 集函数忽略 NULL 值（COUNT ( * ) 除外）
    

### 分组与 HAVING

- `GROUP BY 列名`：将查询结果按指定列分组，每组返回一行
    
- SELECT 子句中只能出现分组列和集函数
    
- `HAVING 条件`：筛选分组，条件中可使用集函数（WHERE 中不能使用集函数）
    
- 执行顺序：FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY
    

## 多表查询（连接查询）

### 内连接（INNER JOIN）

- 等值连接：`WHERE 表1.列 = 表2.列`
    
- 自然连接：等值连接后去除重复列，SQL 中用 USING 或显式列出列
    
- 非等值连接：使用 `>`、`<` 等比较符
    
- 自身连接：同一张表取两个别名进行连接，如 `FROM Course AS FIRST, Course AS SECOND WHERE FIRST.Cpno = SECOND.Cno`
    

### 外连接（OUTER JOIN）

- 左外连接：`LEFT [OUTER] JOIN`，保留左表所有行，右表无匹配填 NULL
    
- 右外连接：`RIGHT [OUTER] JOIN`，保留右表所有行
    
- 全外连接：`FULL [OUTER] JOIN`，保留两表所有行（MySQL 不支持，可用 LEFT JOIN UNION RIGHT JOIN 模拟）
    

## 子查询

一个 SELECT-FROM-WHERE 语句称为一个查询块，嵌套在另一个查询块 WHERE 或 HAVING 条件中的查询称为子查询（嵌套查询）。子查询中不能使用 ORDER BY 子句。

- **不相关子查询**：由里向外逐层处理，子查询结果用于父查询
    
- **相关子查询**：子查询条件依赖于父查询，对外层每个元组执行一次子查询

### 子查询在 FROM 子句中

作为临时表使用，需起别名。如：

```
SELECT IS.Sno, Sname, Cno
FROM SC, (SELECT Sno, Sname FROM Student WHERE Sdept='IS') AS SIS
WHERE SC.Sno = SIS.Sno;
```

### 带有 IN 谓词的子查询

用于返回多个值的查询。如查询与“刘晨”在同一系的学生：

```
SELECT Sno, Sname, Sdept FROM Student
WHERE Sdept IN (SELECT Sdept FROM Student WHERE Sname='刘晨');
```

### 带有比较运算符的子查询

当内层查询返回单值时，可用 `=`、`>` 等比较符。如：

```
SELECT Sno, Sname, Sdept FROM Student
WHERE Sdept = (SELECT Sdept FROM Student WHERE Sname='刘晨');
```

### 带有 ANY 或 ALL 谓词的子查询

- `> ANY`：大于子查询结果中的某个值（即大于最小值）
    
- `> ALL`：大于子查询结果中的所有值（即大于最大值）
    
- `< ANY`：小于子查询结果中的某个值（即小于最大值）
    
- `< ALL`：小于子查询结果中的所有值（即小于最小值）
    

ANY 和 ALL 谓词可用集函数替代，效率更高。例如 `> ANY` 等价于 `> (SELECT MIN(...))`。

### 带有 EXISTS 谓词的子查询

EXISTS 返回逻辑真值或假值，子查询结果非空则返回 TRUE。常用于实现全称量词和逻辑蕴涵。

**用 EXISTS/NOT EXISTS 实现全称量词**：

SQL 中没有全称量词∀，转换为：`(∀x)P ≡ ¬(∃x(¬P))`

例如查询选修了全部课程的学生姓名：

```
SELECT Sname FROM Student
WHERE NOT EXISTS (
    SELECT * FROM Course
    WHERE NOT EXISTS (
        SELECT * FROM SC
        WHERE Sno = Student.Sno AND Cno = Course.Cno
    )
);
```

**用 EXISTS/NOT EXISTS 实现逻辑蕴涵**：

SQL 中没有蕴涵运算，转换为：`p→q ≡ ¬(p ∧ ¬q)`

例如查询至少选修了学生 95002 选修的全部课程的学生号码：

```
SELECT DISTINCT Sno FROM SC SCX
WHERE NOT EXISTS (
    SELECT * FROM SC SCY
    WHERE SCY.Sno = '95002' AND NOT EXISTS (
        SELECT * FROM SC SCZ
        WHERE SCZ.Sno = SCX.Sno AND SCZ.Cno = SCY.Cno
    )
);
```

## 集合查询

### 集合操作类型

- 并操作：`UNION`
    
- 交操作：`INTERSECT`
    
- 差操作：`EXCEPT`
    

MySQL 不支持 INTERSECT 和 EXCEPT，可用其他方式等效实现。

# DML 语言（数据操纵语言）

## 插入数据

### 插入单条元组

```
INSERT INTO <表名> [(<属性列1>, <属性列2>, ...)]
VALUES (<常量1>, <常量2>, ...);
```

- INTO 子句指定表名及属性列，未指定的属性列取空值
    
- VALUES 提供的值必须与 INTO 子句匹配（个数和类型）
    

### 插入子查询结果

```
INSERT INTO <表名> [(<属性列1>, <属性列2>, ...)]
<子查询>;
```

示例：将各系学生平均年龄存入 Deptage 表

```
INSERT INTO Deptage (Sdept, Avgage)
SELECT Sdept, AVG(Sage)
FROM Student
GROUP BY Sdept;
```

## 修改数据

```
UPDATE <表名>
SET <列名> = <表达式> [, <列名> = <表达式>]
[WHERE <条件>];
```

- 修改指定表中满足 WHERE 条件的元组
    
- 缺省 WHERE 条件则修改表中所有元组
    
- 支持带子查询的修改语句
    

## 删除数据

```
DELETE FROM <表名>
[WHERE <条件>];
```

- 删除指定表中满足 WHERE 条件的元组
    
- 缺省 WHERE 条件则删除表中所有元组
    
- 支持带子查询的删除语句
    

# DCL 语言（数据控制语言）

DCL 用于授予或回收访问数据库的特权，控制数据库操纵事务的发生时间及效果，以及对数据库实行监视等。

# 视图

## 视图的定义

视图是一种虚表，是从一个或几个基本表（或视图）导出的表。视图在数据字典中存储的是一条 SELECT 语句，DBMS 执行 CREATE VIEW 时只存储定义，不执行 SELECT 语句。在对视图查询时，按视图定义从基本表中查出数据。

### 创建视图

```
CREATE VIEW <视图名> [(<列名>, <列名>, ...)]
AS <子查询>
[WITH CHECK OPTION];
```

- 组成视图的属性列名需全部省略或全部指定
    
- 当目标列包含集函数或列表达式、多表连接出现同名列、需要为列启用新名字时，必须明确指定所有列名
    

### 视图定义示例

建立信息系学生视图：

```
CREATE VIEW IS_Student AS
SELECT Sno, Sname, Sage
FROM Student
WHERE Sdept='IS';
```

带表达式的视图（派生属性列）：

```
CREATE VIEW BT_S (Sno, Sname, Sbirth) AS
SELECT Sno, Sname, 2000-Sage
FROM Student;
```

带分组的视图：

```
CREATE VIEW S_G (Sno, Gavg) AS
SELECT Sno, AVG(Grade)
FROM SC
GROUP BY Sno;
```

### 不建议使用 SELECT *

用 `SELECT *` 创建视图可扩展性差，当基表结构修改后，视图与基表的映像关系会被破坏。应显式列出所有需要的列。

## 视图的使用

### 视图查询

对视图的查询与对基本表的查询完全相同。

### 视图更新

从用户角度看，对视图的更新与对基本表更新方法相同。但存在不可更新视图——对这些视图的更新不能唯一或有意义地转换成对基本表的更新。例如基于分组和集函数创建的视图不可更新。

一般来说，行列子集视图允许更新。ISO 对可更新视图的规则要求：不含 DISTINCT、SELECT 子句只含列名且不重复、FROM 只含一个表、无嵌套子查询、无 GROUP BY 或 HAVING 等。

### WITH CHECK OPTION

透过视图进行增删改操作时，不得破坏视图定义中的谓词条件。例如：

```
CREATE VIEW IS_Student AS
SELECT * FROM Student WHERE Sdept='IS'
WITH CHECK OPTION;
```

通过该视图插入 `Sdept='CS'` 的记录将被拒绝。

## 视图的作用

- **简化用户操作**：将复杂查询定义为视图，用户直接查询视图
    
- **多角度看待同一数据**：不同用户看到不同的视图
    
- **提供一定程度的逻辑独立性**：当数据库逻辑结构改变时，可通过视图保持外模式不变
    
- **提供安全保护**：对不同用户定义不同视图，限制其可见数据范围
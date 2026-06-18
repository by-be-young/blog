---
type: 专题笔记
series: 数据库
chapter: 2-专题
order: "1"
excerpt: 数据库关系运算转SQL语言的方法专题
---
# 选择运算（$σ$）转化为 SQL

## 基本转化

关系代数中的选择运算 $σ_F(R)$ 对应 SQL 中的 **WHERE** 子句。

**示例** $σ_{Sdept='IS'}(Student)$

```
SELECT * FROM Student WHERE Sdept = 'IS';
```

## 复合条件选择

关系代数中的逻辑运算符（$∧$、$∨$、$¬$）对应 SQL 中的 AND、OR、NOT。

**示例** $σ_{Sdept='IS' ∧ Sage<20}(Student)$

```
SELECT * FROM Student WHERE Sdept = 'IS' AND Sage < 20;
```

# 投影运算（$π$）转化为 SQL

## 基本转化

关系代数中的投影运算 $π_{A_1, A_2, \ldots}(R)$ 对应 SQL 中的 **SELECT** 子句指定列。

**示例** $π_{Sno, Sname}(Student)$

```
SELECT Sno, Sname FROM Student;
```

## 消除重复行

#### 关系代数中投影会自动去重，SQL 中需显式使用 DISTINCT。

**示例** $π_{Sdept}(Student)$

```
SELECT DISTINCT Sdept FROM Student;
```

# 并运算（$∪$）转化为 SQL

关系代数中的 $R∪S$ 对应 SQL 中的 UNION。要求 R 和 S 相容（列数相同，对应列域相同）。

**示例** $π_{Sno}(σ_{Sdept='CS'}(Student)) ∪ π_{Sno}(σ_{Sage≤19}(Student))$

```
SELECT Sno FROM Student WHERE Sdept = 'CS'
UNION
SELECT Sno FROM Student WHERE Sage <= 19;
```

UNION 默认去重，保留所有行用 UNION ALL。

# 交运算（$∩$）转化为 SQL

关系代数中的 $R∩S$ 对应 SQL 中的 INTERSECT。MySQL 不支持 INTERSECT，可用 IN 或 EXISTS 等效实现。

**示例** $π_{Sno}(σ_{Sdept='CS'}(Student)) ∩ π_{Sno}(σ_{Sage≤19}(Student))$

## 方法一（INTERSECT，通用 SQL）：

**MySQL 不支持！**

```
SELECT Sno FROM Student WHERE Sdept = 'CS'
INTERSECT
SELECT Sno FROM Student WHERE Sage <= 19;
```

## 方法二（IN，MySQL 兼容）：

```
SELECT Sno FROM Student
WHERE Sdept = 'CS' AND Sno IN (
    SELECT Sno FROM Student WHERE Sage <= 19
);
```

## 方法三（EXISTS，MySQL 兼容）：

```
SELECT Sno FROM Student S1
WHERE Sdept = 'CS' AND EXISTS (
    SELECT * FROM Student S2
    WHERE S2.Sno = S1.Sno AND S2.Sage <= 19
);
```

# 差运算（$−$）转化为 SQL

关系代数中的 $R−S$ 对应 SQL 中的 EXCEPT。MySQL 不支持 EXCEPT，可用 NOT IN 或 NOT EXISTS 等效实现。

**示例** $π_{Sno}(σ_{Sdept='CS'}(Student)) − π_{Sno}(σ_{Sage≤19}(Student))$

## 方法一（EXCEPT，通用 SQL）：

**MySQL 不支持！**

```
SELECT Sno FROM Student WHERE Sdept = 'CS'
EXCEPT
SELECT Sno FROM Student WHERE Sage <= 19;
```

## 方法二（NOT IN，MySQL 兼容）：

```
SELECT Sno FROM Student
WHERE Sdept = 'CS' AND Sno NOT IN (
    SELECT Sno FROM Student WHERE Sage <= 19
);
```

## 方法三（NOT EXISTS，MySQL 兼容）：

```
SELECT Sno FROM Student S1
WHERE Sdept = 'CS' AND NOT EXISTS (
    SELECT * FROM Student S2
    WHERE S2.Sno = S1.Sno AND S2.Sage <= 19
);
```

# 笛卡尔积（$×$）转化为 SQL

关系代数中的 $R×S$ 对应 SQL 中的 CROSS JOIN 或不带连接条件的多表 FROM。

**示例** $Student×SC$

```
SELECT * FROM Student CROSS JOIN SC;
```

或

```
SELECT * FROM Student, SC;
```

# 连接运算（$⋈$）转化为 SQL

## 等值连接

关系代数中的 $R ⋈_{A=B} S$ 对应 SQL 中的 JOIN... ON 或 WHERE 连接条件。

**示例** $Student ⋈_{Student.Sno=SC.Sno} SC$

```
SELECT * FROM Student JOIN SC ON Student.Sno = SC.Sno;
```

或

```
SELECT * FROM Student, SC WHERE Student.Sno = SC.Sno;
```

## 自然连接

关系代数中的 $R⋈S$ 对应 SQL 中的 NATURAL JOIN，或手动指定公共列的等值连接并去重。

**示例** $Student⋈SC$（公共列为 Sno）

```
SELECT * FROM Student NATURAL JOIN SC;
```

或

```
SELECT Student.Sno, Sname, Ssex, Sage, Sdept, Cno, Grade
FROM Student, SC
WHERE Student.Sno = SC.Sno;
```

## 非等值连接

关系代数中的 $R ⋈_{AθB} S$（$θ$ 为非等号）对应 SQL 中的 JOIN... ON 使用比较运算符。

**示例** $Student ⋈_{Student.Sage > SC.Grade} SC$

```
SELECT * FROM Student JOIN SC ON Student.Sage > SC.Grade;
```

## 自身连接

关系代数中对同一张表做连接运算，对应 SQL 中取两个别名。

**示例** 查询每一门课的间接先修课

关系代数：$π_{FIRST.Cno, SECOND.Cpno}(Course_{FIRST} ⋈_{FIRST.Cpno=SECOND.Cno} Course_{SECOND})$

```
SELECT FIRST.Cno, SECOND.Cpno
FROM Course AS FIRST, Course AS SECOND
WHERE FIRST.Cpno = SECOND.Cno;
```

## 外连接

关系代数中的左外连接、右外连接、全外连接对应 SQL 中的 LEFT JOIN、RIGHT JOIN、FULL JOIN。

**示例** $Student ⟕ SC$

```
SELECT * FROM Student LEFT JOIN SC ON Student.Sno = SC.Sno;
```

# 除运算（$÷$）转化为 SQL

关系代数中的 $R÷S$ 用于"至少…全部…"语义的查询，SQL 中通常用双重 NOT EXISTS 实现。

**示例** 查询选修了全部课程的学生姓名

关系代数：$π_{Sname}(Student ⋈ (π_{Sno, Cno}(SC) ÷ π_{Cno}(Course)))$

```
SELECT Sname FROM Student
WHERE NOT EXISTS (
    SELECT * FROM Course
    WHERE NOT EXISTS (
        SELECT * FROM SC
        WHERE SC.Sno = Student.Sno AND SC.Cno = Course.Cno
    )
);
```

# 关系代数表达式到 SQL 的完整转化对照表

| 关系代数                      | SQL                                             | 备注                          |
| ------------------------- | ----------------------------------------------- | --------------------------- |
| $σ_F(R)$                  | `SELECT * FROM R WHERE F`                       | 选择条件直接翻译                    |
| $π_{A_1, \ldots, A_n}(R)$ | `SELECT A1, ..., An FROM R`                     | 去重需加 DISTINCT               |
| $R∪S$                     | `SELECT ... FROM R UNION SELECT ... FROM S`     | UNION 默认去重                  |
| $R∩S$                     | `SELECT ... FROM R INTERSECT SELECT ... FROM S` | MySQL 用 IN 或 EXISTS         |
| $R−S$                     | `SELECT ... FROM R EXCEPT SELECT ... FROM S`    | MySQL 用 NOT IN 或 NOT EXISTS |
| $R×S$                     | `SELECT * FROM R CROSS JOIN S` 或 `FROM R, S`    | 无条件连接                       |
| $R ⋈_{A=B} S$             | `SELECT * FROM R JOIN S ON R.A = S.B`           | 等值连接                        |
| $R⋈S$                     | `SELECT * FROM R NATURAL JOIN S`                | 自然连接                        |
| $R ⟕ S$                   | `SELECT * FROM R LEFT JOIN S ON ...`            | 左外连接                        |
| $R ⟖ S$                   | `SELECT * FROM R RIGHT JOIN S ON ...`           | 右外连接                        |
| $R ⟗ S$                   | `SELECT * FROM R FULL JOIN S ON ...`            | 全外连接                        |
| $R÷S$                     | 双重 NOT EXISTS                                   | 全称量词查询                      |
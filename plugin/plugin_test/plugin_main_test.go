/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package plugin_test

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/apache/answer/internal/base/data"
	"github.com/apache/answer/internal/migrations"
	"github.com/segmentfault/pacman/cache"
	"github.com/segmentfault/pacman/log"
	"xorm.io/xorm"
	"xorm.io/xorm/schemas"
)

var (
	mysqlDBSetting = TestDBSetting{
		Driver: string(schemas.MYSQL),
	}
	postgresDBSetting = TestDBSetting{
		Driver: string(schemas.POSTGRES),
	}
	sqlite3DBSetting = TestDBSetting{
		Driver:     string(schemas.SQLITE),
		Connection: filepath.Join(os.TempDir(), "answer-plugin-test-data.db"),
	}
	dbSettingMapping = map[string]TestDBSetting{
		mysqlDBSetting.Driver:    mysqlDBSetting,
		sqlite3DBSetting.Driver:  sqlite3DBSetting,
		postgresDBSetting.Driver: postgresDBSetting,
	}
	// after all test down will execute tearDown function to clean-up
	tearDown func()
	// testDataSource used for repo testing
	testDataSource *data.Data
	testCache      cache.Cache
)

func TestMain(t *testing.M) {
	dbSetting, ok := dbSettingMapping[os.Getenv("TEST_DB_DRIVER")]
	if !ok {
		// Use sqlite3 to test.
		dbSetting = dbSettingMapping[string(schemas.SQLITE)]
	}
	sqliteTempDir := ""
	if dbSetting.Driver == string(schemas.SQLITE) {
		var err error
		sqliteTempDir, err = os.MkdirTemp("", "answer-plugin-test-*")
		if err != nil {
			panic(err)
		}
		dbSetting.Connection = filepath.Join(sqliteTempDir, "answer-test-data.db")
		_ = os.RemoveAll(dbSetting.Connection)
	}

	if err := initTestDataSource(dbSetting); err != nil {
		panic(err)
	}
	log.Info("init test database successfully")

	ret := t.Run()
	if tearDown != nil {
		tearDown()
	}
	if sqliteTempDir != "" {
		_ = os.RemoveAll(sqliteTempDir)
	}
	os.Exit(ret)
}

type TestDBSetting struct {
	Driver     string
	Connection string
}

func initTestDataSource(dbSetting TestDBSetting) error {
	connection, imageCleanUp, err := initDatabaseImage(dbSetting)
	if err != nil {
		return err
	}
	dbSetting.Connection = connection

	dbEngine, err := initDatabase(dbSetting)
	if err != nil {
		return err
	}

	newCache, err := initCache()
	if err != nil {
		return err
	}

	newData, dbCleanUp, err := data.NewData(dbEngine, newCache)
	if err != nil {
		return err
	}
	testDataSource = newData
	testCache = newCache

	tearDown = func() {
		dbCleanUp()
		log.Info("cleanup test database successfully")
		imageCleanUp()
		log.Info("cleanup test database image successfully")
	}
	return nil
}

func initDatabaseImage(dbSetting TestDBSetting) (connection string, cleanup func(), err error) {
	if dbSetting.Driver == string(schemas.SQLITE) {
		return dbSetting.Connection, func() {
			log.Info("remove database", dbSetting.Connection)
			err = os.Remove(dbSetting.Connection)
			if err != nil {
				log.Error(err)
			}
		}, nil
	}
	if os.Getenv("TEST_DB_CONNECTION") == "" {
		return "", nil, fmt.Errorf("TEST_DB_CONNECTION is required for %s tests", dbSetting.Driver)
	}
	return os.Getenv("TEST_DB_CONNECTION"), func() {}, nil
}

func initDatabase(dbSetting TestDBSetting) (dbEngine *xorm.Engine, err error) {
	dataConf := &data.Database{Driver: dbSetting.Driver, Connection: dbSetting.Connection}
	dbEngine, err = data.NewDB(true, dataConf)
	if err != nil {
		return nil, fmt.Errorf("connection to database failed: %s", err)
	}
	if err := migrations.NewMentor(context.TODO(), dbEngine, &migrations.InitNeedUserInputData{
		Language:      "en_US",
		SiteName:      "ANSWER",
		SiteURL:       "http://127.0.0.1:8080/",
		ContactEmail:  "answer@answer.com",
		AdminName:     "admin",
		AdminPassword: "admin",
		AdminEmail:    "answer@answer.com",
	}).InitDB(); err != nil {
		return nil, fmt.Errorf("migrations init database failed: %s", err)
	}
	return dbEngine, nil
}

func initCache() (newCache cache.Cache, err error) {
	newCache, _, err = data.NewCache(&data.CacheConf{})
	return newCache, err
}
